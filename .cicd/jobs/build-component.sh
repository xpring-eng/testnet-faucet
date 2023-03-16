#!/bin/bash
. .cicd/helpers/bash_tools.sh
header "BUILD-COMPONENT.SH"

PROJECT_DIR=$PWD
COMPONENT=`echo ${GITHUB_REF_NAME}|cut -d/ -f2`
VERSION=`echo ${GITHUB_REF_NAME}|cut -d/ -f3`

GIT_TAG=$(GITHUB_TOKEN="${GITHUB_TOKEN}" python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_TAG: ' | cut -d ':' -f2)
GIT_BRANCH=$(GITHUB_TOKEN="${GITHUB_TOKEN}" python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_BRANCH:' | cut -d ':' -f2)
GIT_TAG_OR_BRANCH=$(GITHUB_TOKEN="${GITHUB_TOKEN}" python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_TAG_OR_BRANCH:' | cut -d ':' -f2)

if [[ "${GIT_TAG}" =~ (N\/A) ]]; then
	GIT_TAG="${GITHUB_REF_NAME}"
fi
if [[ "${GIT_TAG_OR_BRANCH}" =~ (N\/A) ]]; then
	GIT_TAG_OR_BRANCH="${GITHUB_REF_NAME}"
fi

echo "GIT_BRANCH: ${GIT_BRANCH}"
echo "GIT_TAG: ${GIT_TAG}"
echo "GIT_TAG_OR_BRANCH: ${GIT_TAG_OR_BRANCH}"
echo "GITHUB_REF_NAME: ${GITHUB_REF_NAME}"
echo "VERSION: ${VERSION}"
echo "COMPONENT: ${COMPONENT}"

TYPE=`yq e ".${COMPONENT}.type" ./components.yaml`
echo "type: $TYPE"
case "$TYPE" in
	helm)
		GCR_SA_JSON_RIPPLE=${GCR_SA_JSON_RIPPLE} \
		VERSION=${VERSION} \
		PROJECT_DIR=${PROJECT_DIR} \
		HELM_CHART_DIR=$(yq e ".${COMPONENT}.chart_dir" ./components.yaml) \
		HELM_CHART_NAME=$(yq e ".${COMPONENT}.chart_name" ./components.yaml) \
		HELM_REPO_URL=$(yq e ".${COMPONENT}.repo" ./components.yaml) \
		./.cicd/helpers/package_helm_chart.sh
		EXIT_CODE=$?
		;;

	docker)
		if [ -f ".cicd-local/helpers/pre_build_${COMPONENT}.sh" ]; then
			echo "Running Build script .cicd-local/helpers/pre_build_${COMPONENT}.sh"
			VERSION=${VERSION} \
			COMPONENT=${COMPONENT} \
			/bin/bash "${PROJECT_DIR}/.cicd-local/helpers/pre_build_${COMPONENT}.sh"
		else
			echo "No pre-build scipt found .cicd-local/helpers/pre_build_${COMPONENT}.sh"
			echo "Add one to run commands before a build."
		fi

		REGISTRIES=$(yq e ".${COMPONENT}.docker.registry" ./components.yaml|cut -d " " -f2) \
		PROJECT_DIR=${PROJECT_DIR} \
		DOCKER_DIR=$(yq e ".${COMPONENT}.docker.dir" ./components.yaml) \
		IMAGE_NAME=$(yq e ".${COMPONENT}.docker.image_name" ./components.yaml) \
		VERSION=${VERSION} \
		COMPONENT=${COMPONENT} \
		GITHUB_REF=${GITHUB_REF} \
		DOCKER_BUILD_GITHUB_TOKEN=${DOCKER_BUILD_GITHUB_TOKEN:-$GITHUB_TOKEN} \
		GITHUB_TOKEN=${GITHUB_TOKEN} \
		GET_TAG_OR_BRANCH=${GET_TAG_OR_BRANCH} \
		GCR_SA_JSON_RIPPLE=$GCR_SA_JSON_RIPPLE \
		GCR_SA_JSON_RIPPLEPROD=$GCR_SA_JSON_RIPPLEPROD \
		./.cicd/helpers/docker_build_push.sh
		EXIT_CODE=$?
		echo "Build exited with EXIT_CODE: ${EXIT_CODE}"
		if [ -f ".cicd-local/scripts/post-build_${COMPONENT}.sh" ]; then
			echo "Running Build script .cicd-local/helpers/post-build_${COMPONENT}.sh"
			VERSION=${VERSION} \
			COMPONENT=${COMPONENT} \
			/bin/bash "${PROJECT_DIR}/.cicd-local/helpers/post-build_${COMPONENT}.sh"
			EXIT_CODE=$?
		else
			echo "No post-build scipt found @ .cicd-local/helpers/post-build_${COMPONENT}.sh"
			echo "Add one to run commands before a build."
		fi
		;;
esac
echo "Build exited with EXIT_CODE: ${EXIT_CODE}"
if [[ "${EXIT_CODE}" -ne "0" ]]; then
	BUILD_CLEAN="false"
	header "Build failed!"
else
	BUILD_CLEAN="true"
	header "Build succeeded."
fi
echo "Build Status: ${BUILD_CLEAN}"
#ToDo add slack mesage with webhook and REST API.
if [[ "${GITHUB_REF}" =~ .*"release".* ]]; then
	SLACK_CHANNEL="#ripplex-builds"
else
	SLACK_CHANNEL="#ripplex-builds"
fi

GITHUB_REPOSITORY=${GITHUB_REPOSITORY} \
GITHUB_USER=${GITHUB_ACTOR} \
BUILD_CLEAN=${BUILD_CLEAN} \
BRANCH=${GIT_BRANCH} \
GIT_TAG=${GIT_TAG} \
COMMIT_HASH=${GITHUB_SHA} \
SLACK_CHANNEL=${SLACK_CHANNEL} \
SLACK_WEBHOOK=${SLACK_WEBHOOK} \
python3 "${PROJECT_DIR}/.cicd/helpers/send_slack_message.py"
exit "${EXIT_CODE}"