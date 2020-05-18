import { LinuxPackageUploader, Artifact } from "./linux-package-uploader";
import { promisify } from "util";
import * as path from "path";
import * as os from "os";

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

  const homedir = os.homedir();

  const root = path.join(homedir, "src", "desktop", "dist");

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

  const uploader = new LinuxPackageUploader(token);

  // TODO: how to detect the right release?
  uploader.uploadLinuxPackages('2.5.0-linux2', artifacts, (progress) => {
    console.log("Uploading progress: " + progress);
  })
});
