type ClaimFlowAction = {
  href: string;
  label: string;
  variant?: "primary" | "ghost";
};

type OwnerClaimFlowProps = {
  actions?: ClaimFlowAction[];
  eyebrow: string;
  lead: string;
  title: string;
};

const ownerClaimSteps = [
  {
    label: "Prepare locally",
    text: "Create the package files from your Gitlawb repo without remote writes."
  },
  {
    label: "Verify owner claim",
    text: "Check the package path against the Gitlawb DID before anyone treats it as verified."
  },
  {
    label: "Dry run publish",
    text: "Preview the manifest, claim proof and registry candidate before public listing."
  }
];

export function OwnerClaimFlow({ actions = [], eyebrow, lead, title }: OwnerClaimFlowProps) {
  return (
    <section className="claim-section owner-claim-section" aria-labelledby={headingId(title)}>
      <div className="section-head">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={headingId(title)}>{title}</h2>
        <p>{lead}</p>
        {actions.length > 0 ? (
          <div className="section-actions">
            {actions.map((action) => (
              <a className={`button button-${action.variant ?? "ghost"}`} href={action.href} key={`${action.label}:${action.href}`}>
                {action.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="owner-flow">
        {ownerClaimSteps.map((step, index) => (
          <article className="claim-step" key={step.label}>
            <span className="comparison-title">Step {index + 1}</span>
            <h3>{step.label}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function headingId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
