#!/usr/bin/env bash

set -e

cd "$(git rev-parse --show-toplevel)"

$ELEVATOR && elevate

bash scripts/fix-rpm.sh
bash scripts/distribute.rpm.sh
