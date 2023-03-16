import os
from git import Repo, TagObject
from semantic_version import Version

# It is necessary to set the environment variable GITHUB_SHA to the sha of the current commit.

## Script Flow

# 1. The script gets the GITHUB_SHA environment variable, if it is not set, the script will raise an error.
# 2. The script initializes the git repository and gets the latest version tag by searching for tags that start with 'v' and sorting them by semantic version.
# 3. The script extracts the major, minor and patch version from the latest version tag.
# 4. The script increments the patch version and creates a new tag with the incremented version.
# 5. The script pushes the new tag to the remote repository


def sort_by_semver(tags):
    # Create a list of tuple with tag name and TagObject
    tags = [(tag.name, tag) for tag in tags]
    # Sort tags by semver
    tags.sort(key=lambda x: Version(x[0][1:]), reverse=False)
    # return the original tag objects
    return [tag[1] for tag in tags]

def get_latest_tag(repo):
    """
    Get the latest version tag in the given git repository.
    :param repo: git.Repo object
    :return: git.TagObject object
    """
    # Fetch tags
    repo.remotes.origin.fetch(tags=True)

    # Get latest version tag
    tags = [tag for tag in repo.tags if tag.name.startswith("v")]
    sorted_tags = sort_by_semver(tags)
    latest_tag = sorted_tags[-1]

    return latest_tag

def extract_version(tag):
    """
    Extract the major, minor, and patch versions from a git tag.
    :param tag: git.TagObject object
    :return: tuple of ints (major_version, minor_version, patch_version)
    """
    version = tag.name.split(".")
    major_version = int(version[0][1:])
    minor_version = int(version[1])
    patch_version = int(version[2])

    return major_version, minor_version, patch_version

def increment_version(major_version, minor_version, patch_version):
    """
    Increment the patch version of a semantic version.
    :param major_version: int
    :param minor_version: int
    :param patch_version: int
    :return: tuple of ints (major_version, minor_version, patch_version)
    """
    if major_version == 0 and minor_version == 0:
        major_version, minor_version, patch_version = 0, 1, 0
    else:
        patch_version += 1

    return major_version, minor_version, patch_version

def create_tag(repo, version, sha, message):
    """
    Create a new git tag with the given version and message.
    :param repo: git.Repo object
    :param version: str
    :param sha: str
    :param message: str
    """
    repo.create_tag(version, ref=sha, message=message)
    repo.remotes.origin.push(tags=True)

def main():
    # Get GITHUB_SHA environment variable
    GITHUB_SHA = os.environ.get("GITHUB_SHA")
    if not GITHUB_SHA:
        raise ValueError("GITHUB_SHA environment variable not set.")

    print("GITHUB_SHA:", GITHUB_SHA)

    # Initialize git repository
    repo = Repo("./")

    # Get latest version tag
    latest_tag = get_latest_tag(repo)
    print("Current SemVer Tag:", latest_tag)

    # Extract major, minor, and patch versions
    major_version, minor_version, patch_version = extract_version(latest_tag)

    # Increment patch version
    major_version, minor_version, patch_version = increment_version(major_version, minor_version, patch_version)

    # Create new tag
    repo.git.config('user.email', 'automation@ripplex.com')
    repo.git.config('user.name', 'Github Actions Runner')
    next_tag_version = f"v{major_version}.{minor_version}.{patch_version}"
    print("Next Tag Version:", next_tag_version)
    create_tag(repo, next_tag_version, GITHUB_SHA, "Tagged by python script")

if __name__ == "__main__":
    main()
