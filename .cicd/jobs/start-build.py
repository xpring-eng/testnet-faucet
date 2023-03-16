import subprocess
import yaml
import git

def run_command(command):
    """Run shell command and return output"""
    process = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
    output, _ = process.communicate()
    return output.decode('utf-8').strip()

def parse_yaml(filepath):
    """Parse yaml file and return data as a dictionary"""
    with open(filepath, 'r') as file:
        return yaml.safe_load(file)

def get_current_branch():
    """Get the name of the current Git branch"""
    repo = git.Repo(search_parent_directories=True)
    return repo.active_branch.name

def check_branch_format(branch_name):
    """Check if branch name matches the specified format"""
    if not branch_name.startswith(('feature/', 'main/', 'release/', 'hotfix/')):
        return False
    parts = branch_name.split('/')
    if len(parts) != 2:
        return False
    prefix, identifier = parts
    if not identifier.startswith('xbs-'):
        return False
    if not identifier[4:].isdigit():
        return False
    return True

def main():
    branch = get_current_branch()
    if not check_branch_format(branch):
        print("Error: Current branch name does not match the expected format.")
        print("Expected format: (feature|main|release|hotfix)/(JIRA CARD NUMBER)-(any name that helps identify work in this branch.)")
        print("Example: feature/xbs-533-remove-rsubs-dependencies")
        print("Example: release/xbs-533-rsubs-dep-delete-release")
        exit(1)

    values = parse_yaml('.github/workflows/build.yml')
    env = values['env']
    if env['BRANCH_NAME'] != branch:
        print("Error: BRANCH_NAME environment variable in .github/workflows/build.yml does not match the current branch name.")
        exit(1)

    version = run_command('yq r .github/workflows/build.yml "on.push.branches.\""$BRANCH_NAME"\".steps.build.run.args[0]"')
    print("Current version:", version)

if __name__ == '__main__':
    main()
