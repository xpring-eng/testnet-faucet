#!/bin/bash
set -e
. .cicd/helpers/bash_tools.sh

: "${GCR_SA_JSON_RIPPLE}:?Need to set GCR_SA_JSON_RIPPLE"
: "${HELM_CHART_DIR}:?Need to set HELM_CHART_DIR"
: "${HELM_CHART_NAME}:?Need to set HELM_CHART_NAME"
: "${HELM_REPO_URL}:?Need to set HELM_REPO_URL"
: "${VERSION}:?Need to set VERSION"


HELM_PACKAGING_DIR=helm-package

header "package_helm_chart.sh"
echo "|> VERSION			: ${VERSION}"
echo "|> HELM_CHART_DIR		: ${HELM_CHART_DIR}"
echo "|> HELM_CHART_NAME		: ${HELM_CHART_NAME}"
echo "|> HELM_REPO_URL		: ${HELM_REPO_URL}"
echo "|> HELM_PACKAGING_DIR		: ${HELM_PACKAGING_DIR}"

# OCI artifact references (e.g. tags) do not support the plus sign (+). To support
# storing semantic versions, Helm adopts the convention of changing plus (+) to
# an underscore (_) in chart version tags when pushing to a registry and back to
# a plus (+) when pulling from a registry.
if helm version 1>/dev/null; then
	echo -n "HELM Version:    "
	helm version
else
	LATEST_HELM_VERSION=$(helmenv list-remote | tail -n1)
	echo "Helm not found. Installing helm ${LATEST_HELM_VERSION}"
	helmenv install "${LATEST_HELM_VERSION}"
fi
HELM_REPO_URL_BASE=$(echo -n ${HELM_REPO_URL}| cut -d "/" -f 3)
if [ -z HELM_REPO_URL_BASE ]; then
	echo "Please add a repo: to the helm block of the component.yaml file"
	exit 1
fi
echo "helm registry login ${HELM_REPO_URL_BASE}"
echo -n ${GCR_SA_JSON_RIPPLE} | \
	helm registry login -u "_json_key_base64" --password-stdin "https://${HELM_REPO_URL_BASE}"
  
echo "running: helm dependency build ${HELM_CHART_DIR}/${HELM_CHART_NAME}"
helm dependency build ${HELM_CHART_DIR}/${HELM_CHART_NAME}

mkdir -p ${HELM_PACKAGING_DIR}
echo "running: helm --version ${VERSION} -d ./${HELM_PACKAGING_DIR}/ package ${HELM_CHART_DIR}/${HELM_CHART_NAME}"
helm --version ${VERSION} -d ./${HELM_PACKAGING_DIR}/ package ${HELM_CHART_DIR}/${HELM_CHART_NAME}

header "HELM PUSH"
echo "running: helm push ./${HELM_PACKAGING_DIR}/${HELM_CHART_NAME}-${VERSION}.tgz ${HELM_REPO_URL}"

helm push ./${HELM_PACKAGING_DIR}/${HELM_CHART_NAME}-${VERSION}.tgz ${HELM_REPO_URL}