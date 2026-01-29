set -e

sed -i 's/jp.nonbili.noutube/jp.nonbili.noutube_dev/' app.config.ts
sed -i 's/NouTube/NouTube-dev/' app.config.ts
yes | bun expo prebuild -p android --clean --no-install
