# Application Sensitivity Levels

Applications are classified by data sensitivity to drive access policies.

| Level | Description | Example |
|-------|-------------|---------|
| public | No authentication required for read | public-docs |
| internal | Employee access only | analytics-dashboard |
| confidential | Restricted teams, audit required | payments-api |
| restricted | PII/HR data, explicit approval | hr-portal |

AI agents must check sensitivity before recommending access requests.
