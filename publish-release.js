module.exports = async ({ github, context, core }) => {
    const { RELEASE_ID } = process.env;

    const publish = async () => {
        // Fetch release assets from the source repo
        const assets = await github.rest.repos.listReleaseAssets({
            owner: context.repo.owner,
            repo: 'fedi',
            release_id: RELEASE_ID,
        });

        console.log(`assets: ${JSON.stringify(assets)}`);

        // Find the APK file
        const apkAsset = assets.data.find((asset) => asset.name.endsWith('.apk'));
        if (!apkAsset) {
            throw new Error('APK file not found');
        }

        // Extract version and commit hash from the APK filename
        const regex = /app-production-release-(\d+\.\d+\.\d+)-([0-9a-f]+)\.apk/;
        const match = apkAsset.name.match(regex);
        if (!match) {
            throw new Error('Invalid APK filename format');
        }

        const [fullMatch, version, commitHash] = match;

        // Prepare new release details
        const newTagName = `v${version}`;
        const newTitle = `Fedi Alpha v${version.split('.').slice(0, 2).join('.')} - APK Download`;
        const truncatedCommitHash = commitHash.substring(0, 6);
        const newFileName = `app-production-release-${version}-${truncatedCommitHash}.apk`;
        const newDescription = `Download & Test Fedi Alpha <br><br> Download: [${newFileName}](https://github.com/${context.repo.owner}/fedi-alpha/releases/download/${newTagName}/${newFileName})`;

        // Check if a release with the same title exists in the target repo
        const releases = await github.rest.repos.listReleases({
            owner: context.repo.owner,
            repo: 'fedi-alpha',
        });

        const existingRelease = releases.data.find((release) => release.name === newTitle);

        if (existingRelease) {
            // Update existing release
            await github.rest.repos.updateRelease({
                owner: context.repo.owner,
                repo: 'fedi-alpha',
                release_id: existingRelease.id,
                tag_name: newTagName,
                name: newTitle,
                body: newDescription,
            });
            // TODO: Upload new APK and delete old APK
        } else {
            // Create a new release
            await github.rest.repos.createRelease({
                owner: context.repo.owner,
                repo: 'fedi-alpha',
                tag_name: newTagName,
                name: newTitle,
                body: newDescription,
            });
            // TODO: Upload APK
        }
    };

    try {
        publish();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};
