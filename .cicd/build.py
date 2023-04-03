import sys
import yaml
import semver
import subprocess
import datetime
import getpass
import git
from string import Template
from packaging.version import Version
from packaging.version import parse

stage_map = {
            'feature' : '${major}.${minor}.${patch}-feature-${jira_card}-',
            'beta' : '${major}.${minor}.${patch}-beta-',
            'alpha' : '${major}.${minor}.${patch}-alpha-',
            'main' : '${major}.${minor}.${patch}-develop-',
            'release' : '${major}.${minor}.${patch}-',
            'simple' : '${major}.${minor}.',
            }

def read_components_from_yaml():
    with open("components.yaml", "r") as file:
        data = yaml.safe_load(file)
    return data

def validate_input(stage, components):
    all_stages = ["feature", "main", "release", "hotfix"]
    all_components = read_components_from_yaml()
    if stage == "master":
        print("Please rename your branch name to main")
        print("https://engineering.ripple.com/inclusive-language-initiative-part-1/")
        sys.exit()
    if not stage:
        usage("stage is missing")
    if stage not in all_stages:
        usage(f"Invalid stage: {stage}")
    if not components:
        usage("components are missing")
    if components[0] == "all":
        return all_components
    else:
        invalid_components = [x for x in components if x not in all_components]
        if invalid_components:
            usage(f"Invalid components: {', '.join(invalid_components)}")
    return components

def usage(msg = ''):
    all_components = read_components_from_yaml()
    all_stages = ["feature", "main", "release", "hotfix"]
    if msg:
        print(msg)
    else:
        print("usage: build.py stage component1 [component2 ... [componentN]]")
        print("Stages     : ", ' '.join(all_stages))
        print("Components : all [OR] ", ' '.join(all_components))
    sys.exit()

def get_git_branch(repo):
    branch = repo.active_branch.name
    git_branch_prefix = branch
    git_branch_name = branch
    jira_card = ""
    
    if branch.startswith("feature/") or branch.startswith("hotfix/") or branch.startswith("release/"):
        jira_card = branch.split("/")[1].split("-")[0] + "-" + branch.split("/")[1].split("-")[1]
        git_branch_prefix = branch.split("/")[0]
        git_branch_name = branch.split("/")[1]
    else:
        print("Not a feature branch.")
    
    return git_branch_prefix, git_branch_name, jira_card.replace("-", "")

def stage_to_version_base(stage, major, minor, patch, jira_card, simple_version):
    valid_stages= set(stage.casefold() for stage in ("feature","beta","alpha","main","release","simple"))

    if major == "0" and minor == "0":
        minor="1"
        patch="0"
    if stage != None:
        if simple_version == True:
            stage="simple"

        if not stage.casefold() in valid_stages:
            print(f"Stage '{stage}' not found in valid_stages")
            sys.exit(1)

        version_template = stage_map[stage]
        version_template_obj = Template(version_template)
        version = version_template_obj.safe_substitute(version_template,
                                                major=major,
                                                minor=minor,
                                                patch=patch,
                                                jira_card=jira_card
                                                )
        return version

def extract_versions(tags):
    filtered_tags = []
    for tag in tags:
        namespace, component, version = tag.split("/")
        filtered_tags.append(version)
    return filtered_tags

def sort_by_patch(filtered_tag_versions):
    return sorted(filtered_tag_versions, key=lambda x: int(x.rsplit("-", 1)[-1]), reverse=True)

def tag_latest(component, version_base, repo):

    cv_namespace = "component-version"
    print(f"COMPONENT: {component}")
    print(f"CV_NAMESPACE: {cv_namespace}")
    print(f"VERSION_BASE: {version_base}")
    repo.remotes.origin.fetch()
    all_tags = repo.tags
    tag_names = [tag.name for tag in all_tags]
    component_version_tags = [tag_name.split("/")[-3:] for tag_name in tag_names]
    component_version_tags = ["/".join(c_v_t) for c_v_t in component_version_tags]
    filtered_tags = [tag for tag in component_version_tags if tag.startswith(f"{cv_namespace}/{component}/{version_base}")]
    filtered_tag_versions = extract_versions(filtered_tags)
    filtered_tag_versions = sort_by_patch(filtered_tag_versions)
    print(f"filtered_tag_versions: {filtered_tag_versions}")
    latest_tag = filtered_tag_versions[0] if filtered_tag_versions else None
    print(f"latest_tag: {latest_tag}")
    if latest_tag is None:
        latest_version = f"{version_base}0"
    else:
        patch_part = latest_tag.rsplit("-", 1)[-1]
        patch_increment = int(patch_part) + 1
        latest_version = f"{version_base}{patch_increment}"
    
    print(f"latest_version: {latest_version}")
    print(f"tag: '{cv_namespace}/{component}/{latest_version}'")
    repo.create_tag(f"{cv_namespace}/{component}/{latest_version}", message="Automated tag creation")
    repo.remote("origin").push(f"{cv_namespace}/{component}/{latest_version}")
    return f"{cv_namespace}/{component}/{latest_version}"


def main():
    if len(sys.argv) < 3:
        usage()
    all_components = read_components_from_yaml()
    all_stages = ["feature", "main", "release", "hotfix"]
    # print("All components: ", all_components)
    stage = sys.argv[1]
    components = sys.argv[2:]
    components = validate_input(stage, components)

    repo = git.Repo(search_parent_directories=True)
    repo.config_writer().set_value('user', 'email', "actions@github.com").release()
    repo.config_writer().set_value('user', 'name', "Github Actions Runner").release()
    for remote in repo.remotes:
        remote.fetch()
    git_branch_prefix, git_branch_name, jira_card = get_git_branch(repo)
    print("|> GIT_BRANCH                : ", git_branch_name)
    print("|> GIT_BRANCH_PREFIX/Stage   : ", git_branch_prefix)
    print("|> Jira card                 :",  jira_card)

    if git_branch_prefix != stage:
        print("!!Cannot build for {stage} in a {git_branch_prefix} branch.")
        print("!!Exiting!!!")
        sys.exit()
    print("Starting component builds")
    print("|> date      : ", datetime.datetime.now())
    print("|> components: ", components)
    for component in components:
        if component == "cicd":
            continue
        print(f"component: {component}")
        major = all_components[component]['major_version']
        minor = all_components[component]['minor_version']
        try:
            simple_version = all_components[component]['enable_simple_version']
        except KeyError:
            simple_version = None
            print("enable_simple_version not found for component", component)
        try:
            patch = all_components[component]['patch']
        except KeyError:
            patch = 0
            print("patch not found for component", component)
        print("major: ", major)
        print("minor: ", minor)
        print("patch: ", patch)
        print("jira_card: ", jira_card)
        print("simple_version: ", simple_version)
        version_base = stage_to_version_base(stage, major, minor, patch, jira_card, simple_version)
        version_tag = tag_latest(component, version_base, repo)
        print(f"|>TAGGED {component} with '{version_tag}'")
        print("-------------------------------------------")

if __name__ == "__main__":
    main()