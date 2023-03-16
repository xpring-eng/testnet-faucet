#!/bin/bash

# This script is used to run the build process for the cbdc-admin-ui project.
# It first checks if python3 is installed on the system, if not it uses a docker
# image 'python:3.11.1-slim-buster' to run the script.
#
# Arguments:
#   ARG1 : The stage to build (feature, main, release, hotfix)
#   ARG2 : The component(s) to build, can be one or more.
#
# Usage:
#   ./build.sh feature cbdc-admin-ui-dev
#
# Requirements:
#   - git
#   - python3 (or docker if python3 is not installed)
#
# Example:
#   ./build.sh feature cbdc-admin-ui-dev cbdc-admin-ui-prod
#
# Note:
#   - The script assumes that the current working directory is the root of the
#     cbdc-admin-ui project.
#   - If running the script using docker, make sure that the script is executable
#     and that the user running the script has permissions to use docker.

# Check if python3 is installed
if command -v python3 &>/dev/null; then
  # Run script using python3
  pip3 install --no-input requests gitpython pyyaml semantic_version &>/dev/null;python3 .cicd/build.py "$@"
else
  # Check if docker is installed
  if command -v docker &>/dev/null; then
    # Run script using docker
    docker run -v "$PWD/.cicd/build.py":/app/build.py -w /app  --platform linux/amd64 python:3.11.1-buster \
    sh -c "pip3 install gitpython pyyaml --quiet && python3 /app/build.py  $@"
  else
    # Exit if python3 and docker are not installed
    echo "Error: python3 and docker are not installed"
    exit 1
  fi
fi
