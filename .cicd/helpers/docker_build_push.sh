#!/bin/bash
set -e
. .cicd/helpers/bash_tools.sh
. /root/.bashrc
header "Docker_build_push.sh"

: "${COMPONENT:?Need to set COMPONENT}"
: "${DOCKER_BUILD_GITHUB_TOKEN:?Need to set DOCKER_BUILD_GITHUB_TOKEN}"
: "${DOCKER_DIR:?Need to set DOCKER_DIR}"
: "${GITHUB_TOKEN:?Need to set GITHUB_TOKEN}"
: "${IMAGE_NAME:?Need to set IMAGE}"
: "${REGISTRIES:?Need to set REGISTRIES}"
: "${VERSION:?Need to set VERSION}"



DOCKER_VERSION=$(echo $VERSION| tr + -) #docker doesn't like + charcters in their tags.
REPO_NAME=$(echo "${GITHUB_REPOSITORY}" | cut -d/ -f2)
echo "DOCKER_DIR		: ${DOCKER_DIR}"
echo "IMAGE_NAME		: ${IMAGE_NAME}"
echo "DOCKER_VERSION		: ${DOCKER_VERSION}"
echo "REGISTRIES		: ${REGISTRIES}"

BUILD_PROPERTIES_LOCATION=".${COMPONENT}.docker.build_args"
DOCKER_BUILD_ARGS_JSON=$(yq e "${BUILD_PROPERTIES_LOCATION}" ./components.yaml -o=json || "")
# Convert json to list of --build-arg options
DOCKER_BUILD_ARGS=$(jq -r 'to_entries[] | "--build-arg " + .key + "=" + .value + " "'  <<< "$DOCKER_BUILD_ARGS_JSON" )
DOCKER_BUILD_ARGS=$(tr -d '\n' <<< "$DOCKER_BUILD_ARGS")

header "Building with the following build_properties:"
echo "$(echo "${DOCKER_BUILD_ARGS_JSON}" | jq || "" )"

header "Building Docker Image ${IMAGE_NAME}:${DOCKER_VERSION}"
LAST_DIR=$PWD
echo "cd to '${DOCKER_DIR}'"
cd ${DOCKER_DIR}
DOCKER_BUILD_ARGS=$(echo "${DOCKER_BUILD_ARGS}" | envsubst)
docker build -t latest ${DOCKER_BUILD_ARGS} --build-arg DOCKER_BUILD_GITHUB_TOKEN .
header "Tag and push imags to REGISTRIES: $REGISTRIES"
for REGISTRY in $REGISTRIES; do
	case ${REGISTRY} in
		gcr.io/xpring-dev-sandbox)
			: "${GCR_SA_JSON_RIPPLE:?Need to set GCR_SA_JSON_RIPPLE}"
			echo "Found Registry for 'xpring-dev-sandbox' saving env:GCR_SA_JSON_RIPPLE to file"
			echo "$GCR_SA_JSON_RIPPLE" | base64 -d > /tmp/sa.json
			GCLOUD_SA="1"
			;;
		
		us-central1-docker.pkg.dev/cbdc-helm-repo/ripplex-images)
			: "${GCR_SA_JSON_RIPPLE:?Need to set GCR_SA_JSON_RIPPLE}"
			echo "Found Registry for 'xpring-dev-sandbox' saving env:GCR_SA_JSON_RIPPLE to file"
			echo "$GCR_SA_JSON_RIPPLE" | base64 -d > /tmp/sa.json
			GCLOUD_SA="1"
			;;

		gcr.io/rippleprod-root)
			: "${GCR_SA_JSON_RIPPLEPROD:?Need to set GCR_SA_JSON_RIPPLEPROD}"
			echo "Found Registry for 'rippleprod' saving env:GCR_SA_JSON_RIPPLEPROD to file"
			echo "$GCR_SA_JSON_RIPPLEPROD" | base64 -d > /tmp/sa.json
			GCLOUD_SA="1"
			;;

		ghcr.io/xpring-eng)
			echo "Found ghcr.io/xpring-eng/"
			GCLOUD_SA="0"
			;;
		*)
			echo "Unable to determin GCR SA to use. ABORTING!!"
			exit 1
			;;
	esac

# 	Maybe replace this with a case statment with each type of SA.
	if [[ "${GCLOUD_SA}" == "1" ]]; then
		echo "Activating SA with GCP"
		gcloud auth activate-service-account --key-file /tmp/sa.json
		echo "Configuring Docker Registry"
		if gcloud auth configure-docker $(echo "${REGISTRY}"|cut -d/ -f1) --quiet; then
			echo "Docker configure Successfull w/ GCP CREDS!"
		else
			echo "FAILED DOCKER configure GCP CREDS!!"
			exit 1
		fi

		rm -f /tmp/sa.json && echo "SA JSON file deleted"
		GCLOUD_SA=""
		echo "Checking if TAG '${REGISTRY}/${IMAGE_NAME}:${DOCKER_VERSION}' exists already."
		EXISTING_TAGS=$(gcloud container images list-tags  --filter="tags ~ ^${DOCKER_VERSION}$" --format=json ${REGISTRY}/${IMAGE_NAME} || true)
		if [[ "${EXISTING_TAGS}" != "[]" ]]; then
			header "!!!DOCKER TAG EXISTS! EXITING BUILD!!!"
			exit 1
		fi
	else
		echo "Docker login ghcr.io"
		if echo "${GITHUB_TOKEN}" | docker login ghcr.io -u ${GITHUB_ACTOR} --password-stdin; then
			echo "Docker login Successfull w/ GITHUB_TOKEN!"
		else
			echo "!!FAILED DOCKER LOGIN GITHUB_TOKEN!!"
			exit 1
		fi

		echo "Checking if TAG '${REGISTRY}/${IMAGE_NAME}:${DOCKER_VERSION}' exists already."
		EXISTING_TAGS=$(curl -H "Authorization: Bearer ${GITHUB_TOKEN}" https://ghcr.io/v2/xpring-eng/ripplex-sre-docker/tags/list | jq  .tags)
		if echo ${EXISTING_TAGS}| grep -e "\"\b${DOCKER_VERSION}\b\""; then
			header "!!!DOCKER TAG EXISTS! EXITING BUILD!!!"
			echo "Grep results: $(echo ${EXISTING_TAGS}| grep -e "\"\b${DOCKER_VERSION}\b\"")"
			echo "EXISTING_TAGS: "
			echo ${EXISTING_TAGS}
			exit 1
		fi

	fi
	echo "No existing tag found. Tagging images '${DOCKER_VERSION}','${GITHUB_SHA:0:7}'."
	docker image tag latest ${REGISTRY}/${IMAGE_NAME}:${DOCKER_VERSION}
	docker image tag latest ${REGISTRY}/${IMAGE_NAME}:${GITHUB_SHA:0:7}
	echo "docker image push --all-tags ${REGISTRY}/${IMAGE_NAME}"
	docker image push --quiet --all-tags ${REGISTRY}/${IMAGE_NAME}
	header "Docker image ${REGISTRY}/${IMAGE_NAME}:${DOCKER_VERSION} was pushed"
done

echo "Done."
cd ${LAST_DIR}