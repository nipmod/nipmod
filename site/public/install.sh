#!/usr/bin/env bash
set -euo pipefail

VERSION="${NIPMOD_VERSION:-0.1.35}"
BASE_URL="${NIPMOD_BASE_URL:-https://nipmod.com}"
PACKAGE_NAME="${NIPMOD_PACKAGE_NAME:-nipmod-${VERSION}.tgz}"
PACKAGE_URL="${NIPMOD_PACKAGE_URL:-${BASE_URL}/releases/${PACKAGE_NAME}}"
CHECKSUM_URL="${NIPMOD_CHECKSUM_URL:-${PACKAGE_URL}.sha256}"
SIGNATURE_URL="${NIPMOD_SIGNATURE_URL:-${PACKAGE_URL}.sig}"
NIPMOD_HOME="${NIPMOD_HOME:-${HOME}/.nipmod}"
NIPMOD_BIN_DIR="${NIPMOD_BIN_DIR:-${HOME}/.local/bin}"
NIPMOD_SKIP_GITLAWB="${NIPMOD_SKIP_GITLAWB:-0}"
NIPMOD_DRY_RUN="${NIPMOD_DRY_RUN:-0}"
NIPMOD_ALLOW_UNVERIFIED="${NIPMOD_ALLOW_UNVERIFIED:-0}"
NIPMOD_INSTALL_GITLAWB="${NIPMOD_INSTALL_GITLAWB:-0}"
GITLAWB_INSTALL_URL="${GITLAWB_INSTALL_URL:-https://gitlawb.com/install.sh}"
GITLAWB_INSTALL_SHA256="${GITLAWB_INSTALL_SHA256:-}"
NIPMOD_RELEASE_PUBLIC_KEY_SPKI_BASE64="MCowBQYDK2VwAyEA6UL61NzfF+0vGOVLk12np1u3ukcPq3dsh6Y6IbzkRGo="
NIPMOD_RELEASE_PUBLIC_KEY_SPKI_SHA256="49de8ed6bb670abcefc579534811a1f48c0e478f8427479e0ea05f839f96964e"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: $1 is required" >&2
    exit 1
  fi
}

run() {
  if [ "$NIPMOD_DRY_RUN" = "1" ]; then
    printf 'dry run:'
    printf ' %s' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

verify_release_signature() {
  node - "$1" "$2" "$3" "$NIPMOD_RELEASE_PUBLIC_KEY_SPKI_BASE64" "$NIPMOD_RELEASE_PUBLIC_KEY_SPKI_SHA256" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");

const [archivePath, signaturePath, expectedArtifact, publicKeySpkiBase64, expectedPublicKeySha256] =
  process.argv.slice(2);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const publicKeyDer = Buffer.from(publicKeySpkiBase64, "base64");
const publicKeySha256 = crypto.createHash("sha256").update(publicKeyDer).digest("hex");
if (publicKeySha256 !== expectedPublicKeySha256) {
  fail("release public key fingerprint mismatch");
}

let signature;
try {
  signature = JSON.parse(fs.readFileSync(signaturePath, "utf8"));
} catch {
  fail("release signature file is invalid");
}

if (!signature || typeof signature !== "object") {
  fail("release signature is invalid");
}
if (signature.type !== "dev.nipmod.release.signature.v1") {
  fail("release signature type is invalid");
}
if (signature.algorithm !== "Ed25519") {
  fail("release signature algorithm is invalid");
}
if (signature.artifact !== expectedArtifact) {
  fail("release signature artifact mismatch");
}
if (signature.publicKeySpkiSha256 !== expectedPublicKeySha256) {
  fail("release signature public key mismatch");
}
if (typeof signature.signatureBase64 !== "string" || signature.signatureBase64.length === 0) {
  fail("release signature bytes are invalid");
}

const publicKey = crypto.createPublicKey({
  format: "der",
  key: publicKeyDer,
  type: "spki"
});
const archiveBytes = fs.readFileSync(archivePath);
const signatureBytes = Buffer.from(signature.signatureBase64, "base64");
if (!crypto.verify(null, archiveBytes, publicKey, signatureBytes)) {
  fail("release artifact signature verification failed");
}
NODE
}

need curl
need node
need npm
need git
need tar

node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 22) { console.error("error: Node 22 or newer is required"); process.exit(1); }'

is_local_package_url() {
  case "$PACKAGE_URL" in
    file://* | /* | ./* | ../*) return 0 ;;
    *) return 1 ;;
  esac
}

allow_unverified_local_recovery() {
  [ "$NIPMOD_ALLOW_UNVERIFIED" = "1" ] && is_local_package_url
}

validate_release_package() {
  manifest_file="${tmp_dir}/package.json"
  if ! tar -xOzf "$archive" package/package.json > "$manifest_file" 2>/dev/null; then
    echo "error: release package manifest is missing" >&2
    exit 1
  fi
  node - "$manifest_file" "$VERSION" <<'NODE'
const fs = require("node:fs");

const [manifestPath, expectedVersion] = process.argv.slice(2);
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch {
  console.error("error: release package manifest is invalid");
  process.exit(1);
}

function requireField(condition, message) {
  if (!condition) {
    console.error(`error: ${message}`);
    process.exit(1);
  }
}

requireField(manifest.name === "nipmod", "release package name mismatch");
requireField(manifest.version === expectedVersion, "release package version mismatch");
requireField(manifest.type === "module", "release package type mismatch");
requireField(manifest.bin && manifest.bin.nipmod === "./dist/cli.js", "release package binary mismatch");

const scripts = manifest.scripts && typeof manifest.scripts === "object" ? manifest.scripts : {};
for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
  requireField(!scripts[lifecycle], `release package contains ${lifecycle} script`);
}
NODE
}

post_install_check() {
  doctor_json="${tmp_dir}/doctor.json"
  if ! "$NIPMOD_BIN_DIR/nipmod" doctor --offline --json > "$doctor_json"; then
    echo "error: installed nipmod binary failed its offline doctor check" >&2
    exit 1
  fi
  node - "$doctor_json" <<'NODE'
const fs = require("node:fs");

const [doctorPath] = process.argv.slice(2);
let payload;
try {
  payload = JSON.parse(fs.readFileSync(doctorPath, "utf8"));
} catch {
  console.error("error: installed nipmod doctor output is invalid");
  process.exit(1);
}

const checks = Array.isArray(payload?.data?.checks) ? payload.data.checks : [];
const failures = checks.filter((check) => check && check.status === "fail");
const blocking = failures.filter((check) => check.id !== "gitlawb-helper");
if (blocking.length > 0) {
  for (const check of blocking) {
    console.error(`error: ${check.label || check.id}: ${check.message || "failed"}`);
  }
  process.exit(1);
}
NODE
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
archive="${tmp_dir}/nipmod.tgz"
checksum_file="${tmp_dir}/nipmod.tgz.sha256"
signature_file="${tmp_dir}/nipmod.tgz.sig"

echo "Installing nipmod ${VERSION}"
echo "  Package: ${PACKAGE_URL}"
echo "  Signature: ${SIGNATURE_URL}"
echo "  Prefix:  ${NIPMOD_HOME}"
echo "  Binary:  ${NIPMOD_BIN_DIR}/nipmod"

run mkdir -p "$NIPMOD_HOME" "$NIPMOD_BIN_DIR"
run curl -fsSL "$PACKAGE_URL" -o "$archive"

if [ "$NIPMOD_DRY_RUN" != "1" ]; then
  if curl -fsSL "$CHECKSUM_URL" -o "$checksum_file" 2>/dev/null; then
    expected="$(awk '{print $1}' "$checksum_file")"
    actual="$(sha256_file "$archive")"
    if [ "$expected" != "$actual" ]; then
      echo "error: checksum mismatch" >&2
      echo "  expected: $expected" >&2
      echo "  actual:   $actual" >&2
      exit 1
    fi
  elif allow_unverified_local_recovery; then
    echo "warning: installing without checksum verification" >&2
  else
    echo "error: checksum file is required" >&2
    echo "  checksum: $CHECKSUM_URL" >&2
    echo "  set NIPMOD_ALLOW_UNVERIFIED=1 only for local file recovery" >&2
    exit 1
  fi
  if curl -fsSL "$SIGNATURE_URL" -o "$signature_file" 2>/dev/null; then
    verify_release_signature "$archive" "$signature_file" "$PACKAGE_NAME"
  elif allow_unverified_local_recovery; then
    echo "warning: installing without signature verification" >&2
  else
    echo "error: signature file is required" >&2
    echo "  signature: $SIGNATURE_URL" >&2
    echo "  set NIPMOD_ALLOW_UNVERIFIED=1 only for local file recovery" >&2
    exit 1
  fi
  validate_release_package
fi

run npm install --ignore-scripts --omit=dev --prefix "$NIPMOD_HOME" "$archive"
run ln -sf "$NIPMOD_HOME/node_modules/.bin/nipmod" "$NIPMOD_BIN_DIR/nipmod"

export PATH="$NIPMOD_BIN_DIR:$HOME/.local/bin:$PATH"

if [ "$NIPMOD_INSTALL_GITLAWB" = "1" ] && [ "$NIPMOD_SKIP_GITLAWB" != "1" ] && ! command -v git-remote-gitlawb >/dev/null 2>&1; then
  helper_script="${tmp_dir}/gitlawb-install.sh"
  if [ "$NIPMOD_DRY_RUN" = "1" ]; then
    echo "dry run: curl -fsSL ${GITLAWB_INSTALL_URL} -o ${helper_script}"
    echo "dry run: verify GITLAWB_INSTALL_SHA256"
    echo "dry run: sh ${helper_script}"
  else
    if [ -z "$GITLAWB_INSTALL_SHA256" ]; then
      echo "error: GITLAWB_INSTALL_SHA256 is required when NIPMOD_INSTALL_GITLAWB=1" >&2
      exit 1
    fi
    curl -fsSL "$GITLAWB_INSTALL_URL" -o "$helper_script"
    actual_helper_sha256="$(sha256_file "$helper_script")"
    if [ "$GITLAWB_INSTALL_SHA256" != "$actual_helper_sha256" ]; then
      echo "error: Gitlawb helper installer checksum mismatch" >&2
      echo "  expected: $GITLAWB_INSTALL_SHA256" >&2
      echo "  actual:   $actual_helper_sha256" >&2
      exit 1
    fi
    sh "$helper_script"
  fi
elif [ "$NIPMOD_SKIP_GITLAWB" != "1" ] && ! command -v git-remote-gitlawb >/dev/null 2>&1; then
  echo "Gitlawb publish helper not installed"
  echo "Install works. Publish needs git-remote-gitlawb."
fi

if [ "$NIPMOD_DRY_RUN" != "1" ]; then
  post_install_check
fi

echo ""
echo "Installed nipmod"
echo "Next:"
echo "  nipmod doctor --online"
echo "  nipmod search gitlawb"

case ":$PATH:" in
  *":$NIPMOD_BIN_DIR:"*) ;;
  *)
    echo ""
    echo "Add nipmod to PATH:"
    echo "  export PATH=\"$NIPMOD_BIN_DIR:\$PATH\""
    ;;
esac
