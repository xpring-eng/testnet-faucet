#! /bin/bash

: "${VERSION:? Need to set VERSION}"
: "${COMPONENT:? Need to set COMPONENT}"
: "${CI_GCP_CREDENTIALS:? Need to set CI_GCP_CREDENTIALS}"
: "${MAVEN_GITHUB_TOKEN:? Need to set MAVEN_GITHUB_TOKEN}"

set -e
. ./.cicd/helpers/bash_tools.sh
GITHUB_USERNAME="XpringContinuousIntegration"
GITHUB_TOKEN=${MAVEN_GITHUB_TOKEN}

BUILD_PROPERTIES_LOCATION=".${COMPONENT}.maven_properties"
BUILD_PROPERTIES_LIST=$(yq e "${BUILD_PROPERTIES_LOCATION}" ./components.yaml |sed 's/: /=/g')
BUILD_PROPERTIES=""

mkdir -p ${HOME}/.config/gcloud/
touch ${HOME}/.config/gcloud/application_default_credentials.json
echo "${CI_GCP_CREDENTIALS}" > ${HOME}/.config/gcloud/application_default_credentials.json

echo "Setting version in mvn. ${VERSION}"
mvn versions:set \
	-DnewVersion=${VERSION} &>/dev/null

echo "BUILD_PROPERTIES_LIST: ${BUILD_PROPERTIES_LIST}"
for property in ${BUILD_PROPERTIES_LIST[@]}; do
	BUILD_PROPERTIES+="-D${property} "
done
# BUILD_PROPERTIES+="-DnewVersion=$VERSION " #Example of how to pop an addational input argument.
BUILD_PROPERTIES=$(echo ${BUILD_PROPERTIES}|envsubst)

header "Building with the following build_properties:"
echo "${BUILD_PROPERTIES}"
mvn -s settings.xml --batch-mode clean install ${BUILD_PROPERTIES}
rm -f ${HOME}/.config/gcloud/application_default_credentials.json