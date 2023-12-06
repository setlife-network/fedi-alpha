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

        // Function to upload a new APK to a release
        async function uploadNewApk(releaseId) {
            // Download the APK from the source repository
            const apkBuffer = await github.rest.repos.getReleaseAsset({
                owner: context.repo.owner,
                repo: 'fedi',
                asset_id: apkAsset.id,
                headers: {
                    Accept: 'application/octet-stream',
                },
            });

            // Upload the APK to the target repository
            await github.rest.repos.uploadReleaseAsset({
                url: `https://uploads.github.com/repos/${
                    context.repo.owner
                }/fedi-alpha/releases/${releaseId}/assets?name=${encodeURIComponent(newFileName)}`,
                headers: {
                    'content-type': 'application/vnd.android.package-archive',
                    'content-length': apkBuffer.data.length,
                },
                data: apkBuffer.data,
                name: newFileName,
            });
        }

        // Function to delete old APK from a release
        async function deleteOldApk(releaseId) {
            const assets = await github.rest.repos.listReleaseAssets({
                owner: context.repo.owner,
                repo: 'fedi-alpha',
                release_id: releaseId,
            });

            const oldApkAsset = assets.data.find((asset) => asset.name.endsWith('.apk'));
            if (oldApkAsset) {
                await github.rest.repos.deleteReleaseAsset({
                    owner: context.repo.owner,
                    repo: 'fedi-alpha',
                    asset_id: oldApkAsset.id,
                });
            }
        }

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
            // Upload new APK and delete old APK
            await deleteOldApk(existingRelease.id);
            await uploadNewApk(existingRelease.id);
        } else {
            // Create a new release
            const newRelease = await github.rest.repos.createRelease({
                owner: context.repo.owner,
                repo: 'fedi-alpha',
                tag_name: newTagName,
                name: newTitle,
                body: newDescription,
            });
            // Upload APK
            await uploadNewApk(newRelease.data.id);
        }
    };

    try {
        publish();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};
