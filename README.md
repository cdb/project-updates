# project-updates

An action to update your slack with what's changed on a project board:

- Reads from V2 projects on GitHub
- Stores data as a JSON file committed to a repository
- Accepts field filters to narrow down issues returned
- Post changes (add/remove/changed/completed) to as Slack channel
- Can output to a summary on the check run

Example configuration:

```yml
name: Project Updates
on:
  schedule:
    - cron: "45 0,13,17,21 * * *"
  workflow_dispatch:

# We need to read/write the storage data in this repo
permissions:
  contents: write

jobs:
  project-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: cdb/project-updates@v1
        with:
          project_token: ${{ secrets.ADD_TO_PROJECT_PAT }} # Token with access to read from the project
          project_organization: my-org # Organization that owns the project
          project_number: 1234# Project number
          storage_token: ${{ github.token }} # Token with access to write to the storage repository
          storage_repository: ${{ github.repository }} # Repository to store data in
          storage_path: project-updates/datafile.json # File path for where to store the data
          committer_name: cdb # Name to commit as
          committer_email: cdb@my-org.com # Email to commit as
          slack_token: ${{ secrets.SLACK_BOT_TOKEN }} # Slack token - Leave blank to skip posting to slack
          slack_channel: C01234ABCD # Slack channel to send messages to
          custom_fields: Project # Custom fields from the project board to use, comma separated
          filter: Project:"some project" # Filters to apply to the project board, comma separated, start with '-' for exclusion vs inclusion
```

Docs are...light...at the moment, after it's seen some real-world use we'll know if it's stable as-is.

Heavily based on the ideas in https://github.com/andymckay/project-slack-notification but reworked for the "beta" projects structure.

### Known issues

- Storing the data required the abililty for the passed in token to commit to the default branch of the repo the workflow is running in. This might conflict with any pre-defined branch protections you have on that.
