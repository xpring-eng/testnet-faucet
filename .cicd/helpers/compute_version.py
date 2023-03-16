# import semantic_version
import os
import sys
from string import Template

stage_map = {
			'feature' : '${major}.${minor}.${patch}-feature.${jira_card}+',
 			'beta' : '${major}.${minor}.${patch}-beta+',
 			'alpha' : '${major}.${minor}.${patch}-alpha+',
 			'main' : '${major}.${minor}.${patch}-develop+',
 			'release' : '${major}.${minor}.${patch}+',
 			'simple' : '${major}.${minor}.',
 			}

def stage_to_version_base():
	stage=str(os.environ['STAGE'])
	major=str(os.environ['MAJOR_VERSION'])
	minor=str(os.environ['MINOR_VERSION'])
	patch=str(os.environ['PATCH_VERSION'])
	jira_card=str(os.environ['JIRA_CARD'])
	valid_stages= set(stage.casefold() for stage in ("feature","beta","alpha","main","release","simple"))

	if major == "0" and minor == "0":
		minor="1"
		patch="0"
	if stage != None:
		try:
			simple_version = os.getenv("ENABLE_SIMPLE_VERSION", 'False').lower() in ('true', '1', 't')
		except:
			simple_version = False

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
		print(version)

def check_required_env():
	required_variables=[
						"MAJOR_VERSION",
						"MINOR_VERSION",
						"PATCH_VERSION",
						"STAGE",
						"JIRA_CARD"
						]
	for ENV in required_variables:
		if os.environ.get(ENV) is None:
			print (f"{ENV} is a required ENV input.")
			sys.exit(123)

# Python's main()
if __name__ == "__main__":
	check_required_env()
	stage_to_version_base()


# Why default to 0.1.0?
# https://stackoverflow.com/questions/38252708/is-0-0-1-valid-semver