# project-updates

An action to update your slack with what's changed on a project board. You can use it like this:

```
jobs:
  yourJob:
    runs-on: ubuntu-latest
    steps:
      - uses: cdb/project_updates@v1
        with:
          token: ${{ secrets.... }} // This should be a token that can read from the project and write to the data-store project
          organization: <project-owning-organization> // Organization name the project lives in
          project_number: <project-id-taken-from-url>
          storage_repo: <repository-for-data-store>
          storage_path: <path-to-storage-file-in-data-store-repo>
          committer_name: Project Action Bot
          committer_email: <some-email>
          slack_token: ${{ secrets.SLACK_TOKEN }} // Leave blank to skip posting to slack
          slack_channel: ${{ secrets.SLACK_CHANNEL }}
          custom_fields: <comma-separated-list-of-custom-fields-to-fetch>
          filter: <filter-down-issues-format: fieldName:"filterString">
```

Docs are...light...at the moment, after it's seen some real-world use we'll know if it's stable as-is.

Heavily based on the ideas in https://github.com/andymckay/project-slack-notification but reworked for the "beta" projects structure.

