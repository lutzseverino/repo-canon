# Repo Canon's toolchain: Node.js 24 and pnpm 11, which the development guide
# requires, and the Repository Standards CLI that validates the source. pnpm
# switches to the exact version that `packageManager` pins.
FROM node:24-bookworm
RUN npm install --global --ignore-scripts pnpm@11 @lutzseverino/repo-standards@10.0.0
