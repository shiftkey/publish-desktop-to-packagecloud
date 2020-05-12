// based upon atom-release-publisher
// https://github.com/atom/atom-release-publisher

import got from 'got'
const FormData = require('form-data');
import * as fs from 'fs'
import * as path from 'path'

type ProgressCallback = (text: string) => void

type ReleasePackageDetails = {
  version: string
  type: string
  arch: string
  filePath: string
  fileName: string
  distroName: string
  distroId: number
  distroVersion: string
  releaseSuffix?: string
}

type ReleasePackage = {
  destroy_url: string
}

class LinuxPackageUploader {
  readonly packageRepoName: string
  readonly packageStagingRepoName: string
  readonly apiToken: string

  public constructor (packageRepoName: string, packageStagingRepoName: string, apiToken: string) {
    this.packageRepoName = packageRepoName
    this.packageStagingRepoName = packageStagingRepoName
    this.apiToken = apiToken
  }

  async uploadLinuxPackages (version: string, artifacts: Array<{name: string, filePath: string}>, reportProgress?: ProgressCallback) {
    for (let artifact of artifacts) {
      let fileExt = path.extname(artifact.name)
      switch (fileExt) {
        case '.deb':
          await this._uploadDebPackage(version, artifact.filePath, reportProgress)
          break
        case '.rpm':
          await this._uploadRpmPackage(version, artifact.filePath, reportProgress)
          break
        default:
          continue
      }
    }
  }

  async _uploadDebPackage (version: string, filePath: string, reportProgress?: ProgressCallback) {
    // NOTE: Not sure if distro IDs update over time, might need
    // to query the following endpoint dynamically to find the right IDs:
    //
    // https://{this.apiToken}:@packagecloud.io/api/v1/distributions.json
    await this._uploadPackage({
      version,
      filePath,
      type: 'deb',
      arch: 'amd64',
      fileName: 'github-desktop-amd64.deb',
      distroId: 35 /* Any .deb distribution */,
      distroName: 'any',
      distroVersion: 'any'
    }, reportProgress)
  }

  async _uploadRpmPackage (version: string, filePath: string, reportProgress?: ProgressCallback) {
    await this._uploadPackage({
      version,
      filePath,
      type: 'rpm',
      arch: 'x86_64',
      fileName: 'github-desktop.x86_64.rpm',
      distroId: 140 /* Enterprise Linux 7 */,
      distroName: 'el',
      distroVersion: '7'
    }, reportProgress)
  }

  async _uploadPackage (packageDetails: ReleasePackageDetails, reportProgress?: ProgressCallback) {
    // Infer the package suffix from the version
    if (/-beta\d+/.test(packageDetails.version)) {
      packageDetails.releaseSuffix = '-beta'
    }

    await this._removePackageIfExists(packageDetails, reportProgress)
    await this._uploadToPackageCloud(packageDetails, reportProgress)
  }

  _uploadToPackageCloud (packageDetails: ReleasePackageDetails, reportProgress?: ProgressCallback) {
    return new Promise(async (resolve, reject) => {
      if (reportProgress) reportProgress(`Uploading ${packageDetails.fileName} to ${this.packageStagingRepoName}`)

      const form = new FormData();

      form.append('package[distro_version_id]', packageDetails.distroId);
      form.append('package[package_file]', fs.createReadStream(packageDetails.filePath));

      throw new Error("We don't currently inspect the response from the API")

      await got.post(`https://${this.apiToken}:@packagecloud.io/api/v1/repos/shiftkey/${this.packageStagingRepoName}/packages.json`, { body: form })
      // (error, uploadResponse, body) => {
      //   if (error || uploadResponse.statusCode !== 201) {
      //     if (reportProgress) reportProgress(`Error while uploading '${packageDetails.fileName}' v${packageDetails.version}: ${error || uploadResponse}`)
      //     reject(uploadResponse)
      //   } else {
      //     if (reportProgress) reportProgress(`Successfully uploaded ${packageDetails.fileName}!`)
      //     resolve(uploadResponse)
      //   }
      // })
    })
  }

  async _removePackageIfExists ({ version, type, arch, fileName, distroName, distroVersion, releaseSuffix }: ReleasePackageDetails, reportProgress?: ProgressCallback) {
    // RPM URI paths have an extra '/0.1' thrown in
    let versionJsonPath =
      type === 'rpm'
        ? `${version.replace('-', '.')}/0.1`
        : version

    let existingPackageDetails = await got.get<ReleasePackage>(`https://${this.apiToken}:@packagecloud.io/api/v1/repos/shiftkey/${this.packageStagingRepoName}/package/${type}/${distroName}/${distroVersion}/atom${releaseSuffix}/${arch}/${versionJsonPath}.json`, { responseType: 'json' })

    if (existingPackageDetails && existingPackageDetails.body && existingPackageDetails.body.destroy_url) {
      if (reportProgress) reportProgress(`Deleting pre-existing package ${fileName} in ${this.packageStagingRepoName}`)

      await got.delete(`https://${this.apiToken}:@packagecloud.io/${existingPackageDetails.body.destroy_url}`)
    }
  }
}
