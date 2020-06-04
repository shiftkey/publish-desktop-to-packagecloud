import { LinuxPackageUploader, Artifact } from "./linux-package-uploader";
import { promisify } from "util";
import * as path from "path";

const glob = require("glob");
const globPromise = promisify(glob);

const tokenEnvironmentVariable = "PACKAGECLOUD_API_TOKEN";
const token = process.env[tokenEnvironmentVariable];

if (token == null) {
  console.error(
    `The required environment variable ${tokenEnvironmentVariable} was not found. Exiting...`
  );
  process.exit(1);
}

async function getArtifacts() {
  const artifacts = new Array<Artifact>();

  const root = path.join(__dirname, "dist");

  const debInstallerPath = `${root}/GitHubDesktop-*.deb`;

  let files = await globPromise(debInstallerPath);

  if (files.length !== 1) {
    return Promise.reject(
      `Expected a DEB file but instead found '${files.join(", ")}' - exiting...`
    );
  }

  const deb = files[0];

  artifacts.push({
    name: path.basename(deb),
    filePath: deb,
  });

  const rpmInstallerPath = `${root}/GitHubDesktop-*.rpm`;

  files = await globPromise(rpmInstallerPath);

  if (files.length !== 1) {
    return Promise.reject(
      `Expected a DEB file but instead found '${files.join(", ")}' - exiting...`
    );
  }

  const rpm = files[0];

  artifacts.push({
    name: path.basename(rpm),
    filePath: rpm,
  });

  return artifacts;
}

getArtifacts().then((artifacts) => {
  for (const a of artifacts) {
    console.log(`File ${a.filePath} has name ${a.name}`);
  }

  const firstFile = artifacts[0].name;
  const fileNameRegex = /^GitHubDesktop-linux-(\d+.\d+.\d+.*)\.(deb|rpm)$/;
  const match = firstFile.match(fileNameRegex);

  if (match == null) {
    throw new Error(
      "Unable to find version in string. Check file names and try again."
    );
  } else {
    const version = match[1];

    console.log(`Found ${artifacts.length} files for release ${version}`)

    const uploader = new LinuxPackageUploader(token);

    uploader.uploadLinuxPackages(version, artifacts, (progress) => {
      console.log("Uploading progress: " + progress);
    });
  }
});
