# Security policy

## Report a vulnerability

Please report possible vulnerabilities privately through either of these channels:

- Open the repository's **Security** tab and choose **Report a vulnerability**.
- Email [eyal@formaui.net](mailto:eyal@formaui.net).

Include the affected Lexica version, a description of the impact and the smallest example you can provide to reproduce it. Expression text or definitions and the vocabulary involved are helpful. Please leave out credentials and other private data.

We will reply after reviewing your report. Reports remain private until a fix is available or we agree on disclosure with you. Please avoid posting vulnerability details in a public issue.

## Supported versions

Lexica is in preview. Only the latest version receives fixes.

## Scope

Lexica reads expressions and evaluates them against the vocabulary a host registers. Please report cases where Lexica violates that contract, including:

- An expression reaches a value or calls a function the vocabulary does not declare.
- Crafted text or a definition causes a hang, unbounded resource use or an unexpected failure outside Lexica's error handling.
- A definition's structure or meaning is accepted that the specification refuses.

A registered module runs with the authority of the host that registers it; Lexica does not sandbox its JavaScript. A module's own behavior is the host's responsibility.

If you are unsure whether an issue is security-related, use one of the private reporting channels above.
