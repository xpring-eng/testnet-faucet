import os
import requests
import base64

def send_slack_message(github_repository, github_user, build_clean, branch, commit_hash, slack_channel, slack_webhook, git_tag, github_run_attempt, github_run_id):
    webhook_url = base64.b64decode(slack_webhook).decode("ascii")
    repo_link = f"https://github.com/{github_repository}"
    commit_link = f"https://github.com/{github_repository}/commit/{commit_hash}"
    job_link = f"https://github.com/{github_repository}/actions/runs/{github_run_id}"
    if build_clean == "true":
        build_status_icon = ":white_check_mark:"
        build_status_text = "Successful!"
    else:
        build_status_icon = ":x:"
        build_status_text = "Failed!"

    payload = {
    "channel": slack_channel,
    "blocks": [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"------------------------------------\nBuild status: {build_status_icon}\n"
                }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*GitHub repository:* <{repo_link}|{github_repository}> | *GitHub user:* {github_user}\n*Branch:* {branch}\n*git_tag:* {git_tag}\n*Commit hash:* <{commit_link}|```{commit_hash}```>"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*GitHub Actions Job:*"
            },
            "accessory": {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Job Link"
                },
                "url": job_link
            }
        }
    ]
}





    
    response = requests.post(webhook_url, json=payload)
    if response.status_code == 200:
        print("Successfully sent Slack message")
    else:
        print("Error sending Slack message")

github_repository = os.environ.get("GITHUB_REPOSITORY")
github_user = os.environ.get("GITHUB_USER")
git_tag = os.environ.get("GIT_TAG")
build_clean = os.environ.get("BUILD_CLEAN")
branch = os.environ.get("BRANCH")
commit_hash = os.environ.get("COMMIT_HASH")
slack_channel = os.environ.get("SLACK_CHANNEL")
slack_webhook = os.environ.get("SLACK_WEBHOOK")
github_run_attempt = os.environ.get("GITHUB_RUN_ATTEMPT")
github_run_id = os.environ.get("GITHUB_RUN_ID")

if not all([github_repository, github_user, build_clean, branch, commit_hash, slack_channel]):
    variables = ["GITHUB_REPOSITORY", "GITHUB_USER", "GIT_TAG", "BUILD_CLEAN", "BRANCH", "COMMIT_HASH", "SLACK_CHANNEL", "SLACK_WEBHOOK", "GITHUB_RUN_ATTEMPT", "GITHUB_RUN_ID"]
    not_set = [var for var in variables if os.environ.get(var) is None or os.environ.get(var) == ""]
    print(f"Error: The following environment variables are not set: {', '.join(not_set)}")
else:
    send_slack_message(github_repository, github_user, build_clean, branch, commit_hash, slack_channel, slack_webhook, git_tag, github_run_attempt, github_run_id)