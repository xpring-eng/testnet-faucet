import os
import git

valid_stages = ("feature", "main", "release", "hotfix")

def get_branch(git_repo, git_sha):
    git_branch = None
    try:
        if git_repo.head.is_detached:
            git_branch = os.environ.get("GITHUB_REF", "").replace("refs/heads/", "")
        else:
            git_branch = git_repo.head.reference.name.replace("refs/heads/", "")
    except git.exc.InvalidGitRepositoryError as e:
        print(f'Error: {e}')
    if git_branch is not None and not git_branch.startswith(valid_stages):
        git_branch = None
    if git_branch is None:
        try:
            git_branch = git_repo.git.branch("--contains", git_sha)
            git_branch = git_branch.strip().replace("* ", "")
        except git.exc.GitCommandError as e:
            print(f'Error: {e}')
        if git_branch is not None and not git_branch.startswith(valid_stages):
            git_branch = None
    if git_branch is None:
        git_branch = 'N/A'
    return git_branch


def get_tag(git_repo):
    git_tag = None
    try:
        git_tag = git_repo.git.describe(os.environ["GITHUB_SHA"],tags=True)
    except git.exc.GitCommandError as e:
        print(f'Error: {e}')
    if git_tag is not None:
        git_tag = git_tag.replace("refs/tags/", "")
    git_tag = git_tag if git_tag is not None else "N/A"
    return git_tag

def get_tag_or_branch():
    git_repo = git.Repo(os.getcwd())
    git_sha = os.environ["GITHUB_SHA"]
    git_tag = get_tag(git_repo)
    git_branch = get_branch(git_repo, git_sha)
    git_tag_or_branch = git_tag if git_tag != "N/A" else git_branch
    return git_tag, git_branch, git_tag_or_branch

if __name__ == "__main__":
    git_tag, git_branch, git_tag_or_branch = get_tag_or_branch()
    print(f"GIT_TAG: {git_tag}")
    print(f"GIT_BRANCH: {git_branch}")
    print(f"GIT_TAG_OR_BRANCH: {git_tag_or_branch}")
