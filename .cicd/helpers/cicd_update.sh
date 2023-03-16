#!/bin/bash

# Set the directories for the .cicd folder and the cicd-scripts repo
cicd_dir="./.cicd"
repo_dir="/tmp/ripplex-cicd-scripts/cicd-scripts"

changes=false;
# Iterate through all files in the .cicd folder
for file in "$cicd_dir"/*; do
    # Get the filename without the path
    filename="${file##*/}"
    # Calculate the SHA-1 hash of the file in the .cicd folder
    cicd_hash=$(shasum -a 1 "$file" | awk '{print $1}')
    # Calculate the SHA-1 hash of the corresponding file in the repo
    repo_hash=$(shasum -a 1 "$repo_dir/$filename" | awk '{print $1}')
    # Compare the two hashes
    if [ "$cicd_hash" != "$repo_hash" ]; then
        # If the hashes are different, copy the file from the repo to the .cicd folder without prompting for overwrite
        cp -f "$repo_dir/$filename" "$cicd_dir/$filename"
        git add "$cicd_dir/$filename"
        git commit -m "updated $filename in cicd folder"
        changes=true;
    fi
done

if [ "$changes" == true ]; then
  git push
else 
  echo "No changes found"
  exit 0;
fi
