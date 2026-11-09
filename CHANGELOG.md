## [2.2.1](https://github.com/nielsreijnders/payload-content-ops/compare/v2.2.0...v2.2.1) (2026-11-09)


### Bug Fixes

* detect missing published translations and verify every saved field ([0371a6f](https://github.com/nielsreijnders/payload-content-ops/commit/0371a6f0c04ef38315cfdb9ee4f5f7f6551965c5))

# [2.2.0](https://github.com/nielsreijnders/payload-content-ops/compare/v2.1.3...v2.2.0) (2026-08-14)


### Features

* verify saved translations persist and add contentOps save context ([d7d6cae](https://github.com/nielsreijnders/payload-content-ops/commit/d7d6cae5d16c533f0decb7501d350c8bb67375ae))

## [2.1.3](https://github.com/nielsreijnders/payload-content-ops/compare/v2.1.2...v2.1.3) (2026-08-13)


### Bug Fixes

* apply link sync inside localized arrays and store same-origin urls relative ([d129534](https://github.com/nielsreijnders/payload-content-ops/commit/d129534119bf1b1df3587d42670593aeb86abc09))

## [2.1.2](https://github.com/nielsreijnders/payload-content-ops/compare/v2.1.1...v2.1.2) (2026-08-13)


### Bug Fixes

* keep shared array row ids on locale-scoped saves ([e83ce14](https://github.com/nielsreijnders/payload-content-ops/commit/e83ce14ecaeaa8cad391b4df807b1c248ab041f4))

## [2.1.1](https://github.com/nielsreijnders/payload-content-ops/compare/v2.1.0...v2.1.1) (2026-08-13)


### Bug Fixes

* document status issues ([f94dafe](https://github.com/nielsreijnders/payload-content-ops/commit/f94dafeb56356b56fd7d0001b857c0e6e307105d))

# [2.1.0](https://github.com/nielsreijnders/payload-content-ops/compare/v2.0.0...v2.1.0) (2026-08-12)


### Features

* add bulk translations for globals ([15e3ec4](https://github.com/nielsreijnders/payload-content-ops/commit/15e3ec4216f23617fa64dbe3cba1fd86fbcedc91))

# [2.0.0](https://github.com/nielsreijnders/payload-content-ops/compare/v1.31.0...v2.0.0) (2026-08-12)


* feat!: rename package to payload-content-ops ([fb9df77](https://github.com/nielsreijnders/payload-content-ops/commit/fb9df77f54d0b61ae312270310fa1446340e7d27))


### Features

* per-feature model settings, prompt caching, and smarter request batching ([9a4f4bd](https://github.com/nielsreijnders/payload-content-ops/commit/9a4f4bdc15a6da42526c81c7ada1a54e861077a0))


### BREAKING CHANGES

* Admin components resolve via
`payload-content-ops/client` instead of
`payload-sync-ai-translations/client`. After swapping the dependency,
update the import to `import { payloadContentOps } from
'payload-content-ops'` (the old export name still works) and run
`payload generate:importmap` — without regenerating the import map the
admin panel cannot resolve the plugin components.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

# [1.31.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.30.0...v1.31.0) (2026-07-07)


### Features

* enhance translation status management with link syncing and skip field options ([3e543e2](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/3e543e259fcd8664fe1f55dd20b80868e98afa74))

# [1.30.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.29.0...v1.30.0) (2026-07-07)


### Features

* **sync-status:** implement sync status scanning and document handling ([d935d86](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d935d860de81a05b86a0b40916b75d1d8f3539a1))

# [1.29.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.28.0...v1.29.0) (2026-07-07)


### Features

* replace Button components with IconTooltipButton for improved UI consistency ([9a33dd5](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9a33dd5f4ac9209e8b23497d40c85c4f5d4dc635))

# [1.28.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.27.0...v1.28.0) (2026-07-07)


### Features

* implement SEO scoring and management features ([632bdf9](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/632bdf9821a2ae9481083bcd458ff2610f8afaa9))

# [1.27.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.26.0...v1.27.0) (2026-06-03)


### Features

* add better type safety ([cd2484d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/cd2484d24a56c9539f2261af0e4a4f3c46101015))

# [1.26.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.25.3...v1.26.0) (2026-06-03)


### Features

* add overwrite setting in AI bulk translation ([8444d76](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/8444d7613fe0cb68eaed7a484905977b13e2e363))

## [1.25.3](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.25.2...v1.25.3) (2026-04-29)


### Bug Fixes

* issues merging locale translations ([fff3cfe](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/fff3cfe1a08e44662f09c7a71492abed68f33c01))

## [1.25.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.25.1...v1.25.2) (2026-04-26)


### Bug Fixes

* not translating if text is the same on other locales ([4ec99d6](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/4ec99d6a45673e4a2fa848ebac24e093821e579f))

## [1.25.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.25.0...v1.25.1) (2026-04-25)


### Bug Fixes

* invalid nested row IDs when translating localized arrays ([b4ff103](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/b4ff103069d2d3247c57d318651a9e9c2033a57f))

# [1.25.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.24.2...v1.25.0) (2026-04-25)


### Features

* add collapsible field support ([2b631ed](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/2b631edd38f9a73461187af654a67e0cc0305a4a))

## [1.24.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.24.1...v1.24.2) (2026-04-25)


### Bug Fixes

* issues invalid id document ([04f0a3a](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/04f0a3a76fac26fcc5fdeb88cf1c791de279f811))

## [1.24.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.24.0...v1.24.1) (2026-04-25)


### Bug Fixes

* issues updating rows in a globals ([9f4a83d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9f4a83d2473e304287ee55048f9303e44aac9042))

# [1.24.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.23.1...v1.24.0) (2026-04-24)


### Features

* add blockReferences support ([5265d6f](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/5265d6fedac00825277368d2736190a8cb4d3a9a))
* update payload packages ([167a401](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/167a401eb098b640bf94f1d242d1a988c10f5e9f))

## [1.23.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.23.0...v1.23.1) (2026-04-24)


### Bug Fixes

* restore missing nested localized fields before saving translations ([cf661da](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/cf661da9a915c0a04fddca2dc56c7b33730ed393))

# [1.23.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.22.0...v1.23.0) (2026-04-16)


### Features

* Add support for a custom openai compatible endpoint ([10e92fb](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/10e92fb041e693116b8debc298e06eb32125816d))

# [1.22.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.21.0...v1.22.0) (2026-03-02)


### Features

* enhance grammar check handler with fallback item collection and identifier path merging ([2e304c9](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/2e304c9a2f3feaae680cfc4bc1e1c6af9e65a98d))

# [1.21.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.20.0...v1.21.0) (2026-03-02)


### Features

* add bulk grammar check functionality with OpenAI integration ([8225385](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/82253857b49f33270b78d7b04eefba80b969e91b))

# [1.20.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.19.2...v1.20.0) (2026-03-02)


### Features

* Add Payload skills ([dde63a4](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/dde63a4b4870cf778c1b3d640b91a1bea15fef8b))

## [1.19.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.19.1...v1.19.2) (2025-11-23)


### Bug Fixes

* refactor link synchronization logic to improve URL collection and locale handling ([22cdba7](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/22cdba7dcc88dfb3d8ca51a68b8edee02f9b7ca3))

## [1.19.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.19.0...v1.19.1) (2025-11-23)


### Bug Fixes

* replace mergeStructuralData with cloneLocaleData for locale handling ([539b450](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/539b450cc15b474a9fb43a2f68845c8278c6f23f))

# [1.19.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.18.5...v1.19.0) (2025-11-23)


### Bug Fixes

* add eslint directive to suppress warning for unused capturing group in regex ([9717fb4](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9717fb46bb4223160a007feecb323d54469c1841))
* enhance mergeStructuralData function with additional options for better array handling ([b36dd9d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/b36dd9d5344ebf26656e036ddabb1a8d1111aa91))
* restore validator dependency in the lockfile ([528b951](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/528b951fe99f912d7be7e9d02259c6418e19a079))


### Features

* add LinkField and LinksField components for menu configuration ([0a0510d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/0a0510d44b5ac7b103b20171eb8c7e19eb45ac54))

## [1.18.5](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.18.4...v1.18.5) (2025-11-23)


### Bug Fixes

* streamline array formatting in global link definitions ([f9d3141](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/f9d31415b27a92feb2fecc6172ac3f7be1735104))

## [1.18.4](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.18.3...v1.18.4) (2025-11-23)


### Bug Fixes

* refactor link occurrence collection for clarity ([ecaa993](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/ecaa99357f9bfa8aeb8dc892cdfe71908a759293))

## [1.18.3](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.18.2...v1.18.3) (2025-11-23)


### Bug Fixes

* streamline conditional check in mergeStructuralData function ([f5a060d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/f5a060d148ca4ba11e35d994e6a10c5a9f30df76))

## [1.18.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.18.1...v1.18.2) (2025-11-23)


### Bug Fixes

* a issue with duplicated array items ([f623770](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/f6237705d1d70092c820b7a1f3f81edd1d9b189d))

## [1.18.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.18.0...v1.18.1) (2025-11-23)


### Bug Fixes

* simplify map creation in linkAlternate mock ([3304b96](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/3304b961161cfc7957f6b848206abdbdbd3cb4f6))

# [1.18.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.6...v1.18.0) (2025-11-23)


### Features

* add globals configuration for menu with title and links structure ([d35ac1e](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d35ac1e9b3c43429aa01d50cf91f8bedddf4ba2b))

## [1.17.6](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.5...v1.17.6) (2025-11-22)


### Bug Fixes

* invalid id for globals ([16b1f6d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/16b1f6d6dfd966dfc1db435b668adc5370fce7cc))

## [1.17.5](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.4...v1.17.5) (2025-11-22)


### Bug Fixes

* improve type filtering and logging in bulk translation and link sync handlers ([8916f25](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/8916f25b0b4872e8a38b354d35852fd43570bc18))

## [1.17.4](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.3...v1.17.4) (2025-11-22)


### Bug Fixes

* format imports and remove unnecessary comment in bulk sync handler ([9c3467d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9c3467d8c356d22202374cd38206bfa1ed1a6eaa))

## [1.17.3](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.2...v1.17.3) (2025-11-17)


### Bug Fixes

* streamline imports and remove default locale save check in translation stream ([e50329f](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/e50329f3851f5e6f6659f920b8c7951c046eb20f))

## [1.17.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.1...v1.17.2) (2025-11-17)


### Bug Fixes

* skip saving for default locale in global documents ([ca89d6d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/ca89d6d2c6a0b5db5419d84afb56045b4be0ad2e))

## [1.17.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.17.0...v1.17.1) (2025-11-17)


### Bug Fixes

* reorder identifier keys for consistency ([279f418](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/279f4182c75f748e8dd2d1b01b6cff0dc8ec93f7))

# [1.17.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.8...v1.17.0) (2025-11-17)


### Features

* add identifierPaths to remove id's from being translated ([0599fee](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/0599fee55c3c50f556f4baf1df12655b6d98ce2d))

## [1.16.8](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.7...v1.16.8) (2025-11-17)


### Bug Fixes

* add comment to clarify purpose of pruneIdentifierFields function ([3e4eff1](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/3e4eff151142b852bd956fc8a5fe35f1159f50cf))

## [1.16.7](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.6...v1.16.7) (2025-11-17)


### Bug Fixes

* issue invalid id globals ([e4744b1](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/e4744b140c9bcd7cd51d8b229b7d38d3583a1163))

## [1.16.6](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.5...v1.16.6) (2025-11-16)


### Bug Fixes

* strip nested metadata when saving globals ([a12e6b0](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/a12e6b0e47926535a7068744675f135ae77c448e))

## [1.16.5](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.4...v1.16.5) (2025-11-16)


### Bug Fixes

* skip metadata when saving globals ([d3c5a4f](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d3c5a4f182c7d974db78c4270354ee494b5736f5))

## [1.16.4](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.3...v1.16.4) (2025-11-16)


### Bug Fixes

* improve code formatting and structure in documentUtils.ts ([7a69129](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/7a691296aa2592f2940dc1064a053bddbdc12491))

## [1.16.3](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.2...v1.16.3) (2025-11-16)


### Bug Fixes

* issues diabled global buttons ([d05baaf](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d05baafe06e8490a7987dd92ce1ba09c28417a8b))

## [1.16.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.1...v1.16.2) (2025-11-16)


### Bug Fixes

* issues loading in custom components ([430d77a](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/430d77ab62a6d8888e8f22fc2cce842d198d7955))

## [1.16.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.16.0...v1.16.1) (2025-11-16)


### Bug Fixes

* having some versions issue because i have no time ([e54f013](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/e54f0137e4cb552154267e99bbe450e972816c1f))

# [1.16.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.15.1...v1.16.0) (2025-11-16)


### Bug Fixes

* correct formatting of features section in README ([8a88789](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/8a88789025109b03b4149bb4ce9d5399bbe775b4))
* versioning issue after reverting ([4c098a6](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/4c098a6ebde226f5de55913d8080823abeb06b01))


### Features

* add .swcrc configuration file for TypeScript and React ([6c084d1](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/6c084d13b57cf2d694d1c7fd978c1f9b2d9e3edb))
* add globals support ([d70eb05](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d70eb0553792434d0cc9faa3bf231a00ea7b1418))

# [1.16.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.15.1...v1.16.0) (2025-11-16)


### Bug Fixes

* versioning issue after reverting ([4c098a6](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/4c098a6ebde226f5de55913d8080823abeb06b01))


### Features

* add globals support ([d70eb05](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d70eb0553792434d0cc9faa3bf231a00ea7b1418))

# [1.16.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.15.1...v1.16.0) (2025-11-16)


### Bug Fixes

* versioning issue after reverting ([4c098a6](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/4c098a6ebde226f5de55913d8080823abeb06b01))


### Features

* add globals support ([d70eb05](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d70eb0553792434d0cc9faa3bf231a00ea7b1418))

# [1.16.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.15.1...v1.16.0) (2025-11-16)


### Features

* add globals support ([d70eb05](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d70eb0553792434d0cc9faa3bf231a00ea7b1418))

## [1.15.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.15.0...v1.15.1) (2025-11-16)


### Bug Fixes

* issues with select/radio/relationship fields ([fd76e19](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/fd76e19b5a8ab98f2a8be746bd2fa6f7620cfad0))

# [1.15.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.14.0...v1.15.0) (2025-11-16)


### Features

* prevent AI model from translating the prompt by isolating items payload ([15e6f61](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/15e6f61fdceb01f728d70c8519df32684eeaa627))

# [1.14.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.13.1...v1.14.0) (2025-11-16)


### Features

* optimize batch debug logs ([def29b8](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/def29b833584618212fd6c18c41603809719a6ec))

## [1.13.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.13.0...v1.13.1) (2025-11-15)


### Bug Fixes

* add an customPropt example ([2f27bf9](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/2f27bf92ef95cf247ce128b77e6e4cdc371fba3c))

# [1.13.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.12.1...v1.13.0) (2025-11-15)


### Features

* allow custom translation prompts per collection ([21d18d8](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/21d18d8adba0e685e0c3c6d4bfb43efcc47feff7))

## [1.12.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.12.0...v1.12.1) (2025-11-11)


### Bug Fixes

* remove unnecessary docs ([30d1f6e](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/30d1f6ec2cdeefc9e65ca8b33bb87f6907762081))

# [1.12.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.11.0...v1.12.0) (2025-11-11)


### Features

* add JSON schema for translation review response format ([1f34673](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/1f34673bd83e7d6edc51303cd7f96cec20297d2b))
* batch translation chunks to reduce API calls ([5e951b4](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/5e951b4d7974b34b48f47ddc8c4424dc1f0ba251))

# [1.11.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.10.4...v1.11.0) (2025-11-09)


### Bug Fixes

* merge oopsie ([e87d7ca](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/e87d7ca880f6911c7b289ff729b89e24bc7f5740))


### Features

* merge multiple entries ([fef371d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/fef371dbcec4ac935c9630bb777315985d74aa95))

## [1.10.4](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.10.3...v1.10.4) (2025-11-09)


### Bug Fixes

* add response_format to openai response ([74ea470](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/74ea4705d330e79094ab0202dfc51297d393fd30))

## [1.10.3](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.10.2...v1.10.3) (2025-11-09)


### Bug Fixes

* repair openai faulty json response ([91a406a](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/91a406a2c5f0f303f9ae3237e169fdd296b48925))

## [1.10.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.10.1...v1.10.2) (2025-11-09)


### Bug Fixes

* typo import ([bbfbf0b](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/bbfbf0bf72073739ea527f2a74222a117c6b1a55))

## [1.10.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.10.0...v1.10.1) (2025-11-09)


### Bug Fixes

* format tests ([ef961ca](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/ef961ca4a3a521e1511a6fa59ed32fb8a3076aec))

# [1.10.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.9.0...v1.10.0) (2025-11-09)


### Features

* translate each chunk with openai ([4815e98](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/4815e98accd6187ace86fe6b2da82ed4ffe0311e))

# [1.9.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.8.0...v1.9.0) (2025-11-09)


### Features

* shorten locales array for testing ([679f36c](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/679f36cdb6734ff2ca44ebf31ca9f455c9c5801a))

# [1.8.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.7.2...v1.8.0) (2025-11-09)


### Features

* add tabs configuration to posts collection ([075a1f2](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/075a1f29836ad6c0c5ca57985377fe49407683b3))

## [1.7.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.7.1...v1.7.2) (2025-11-09)


### Bug Fixes

* issues with type tabs ([64c097d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/64c097daf3b704ab04677a081cd2f1cb850ef21e))

## [1.7.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.7.0...v1.7.1) (2025-11-09)


### Bug Fixes

* issue type blocks ([9dcb1dc](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9dcb1dc3648b9f19bfe12e3c48d3ade397eb79b2))

# [1.7.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.6.0...v1.7.0) (2025-11-09)


### Bug Fixes

* a versioning issue lol ([05a6990](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/05a69906c3f47bad5bd0e2ffb4c28edd88d211f2))
* remove outdated publishing instructions from README ([a0634c0](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/a0634c0fb0df8926d32e598f41723f623ac25bf2))


### Features

* add document synchronization link components and improve loadLocalizedDocument function ([2c42c06](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/2c42c06147bce67a92b27cfef42d594fe48c1763))
* publish link syncing ([34012f7](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/34012f777faeaaefe72206c6cb55ba198094a2aa))

## [1.6.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.6.0...v1.6.1) (2025-11-04)


### Bug Fixes

* a versioning issue lol ([05a6990](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/05a69906c3f47bad5bd0e2ffb4c28edd88d211f2))
* remove outdated publishing instructions from README ([a0634c0](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/a0634c0fb0df8926d32e598f41723f623ac25bf2))

## [1.6.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.6.0...v1.6.1) (2025-11-04)


### Bug Fixes

* remove outdated publishing instructions from README ([a0634c0](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/a0634c0fb0df8926d32e598f41723f623ac25bf2))

# [1.6.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.5.2...v1.6.0) (2025-11-04)


### Bug Fixes

* debug button types ([41feb9f](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/41feb9f5c8568e3715fb208dd5eb04c6e0679d17))


### Features

* add DebugDocumentCopyButton and enable debug mode in configuration ([d5aca9f](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/d5aca9fffa27cf38886a4fc0cd629bfd7215c053))

## [1.5.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.5.1...v1.5.2) (2025-11-04)


### Bug Fixes

* example commit ([0b8edc9](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/0b8edc9a3e19eb340832a262f00e256461d45c1d))

## [1.5.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.5.0...v1.5.1) (2025-11-04)


### Bug Fixes

* streamline text handling in translation review generation ([9e3a79c](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9e3a79c1e566321db468760ccddd787197dee844))

# [1.5.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.4.1...v1.5.0) (2025-11-04)


### Features

* remove local development and testing sections from README ([c6afe38](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/c6afe381f2616eeec7e6fc7972b564a99186506b))

## [1.4.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.4.0...v1.4.1) (2025-11-03)


### Bug Fixes

* simplify structure key handling and streamline logger messages ([990cd23](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/990cd23d55c7e025f160ca92af580f82bce39136))

# [1.4.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.3.0...v1.4.0) (2025-11-03)


### Features

* implement auto-translate button functionality with review and translation handling ([5776f25](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/5776f25704e1763fbcb15c4f5b63aaa9cb5420e7))

# [1.3.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.2.0...v1.3.0) (2025-10-26)


### Features

* improve UI bulk translations ([f901ecc](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/f901ecc3b3e96536c0ecf7280491f7711b099bcf))

# [1.2.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.1.2...v1.2.0) (2025-10-26)


### Bug Fixes

* ts error ([6b8a7ef](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/6b8a7ef1aa81d01d5f11e012ad76a8442ab90851))


### Features

* add bulk translation workflow ([cc7e1fe](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/cc7e1fe47185651f0052a91a03804319a8b95754))
* add BulkTranslateGlobal to import map ([2d5be9d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/2d5be9d11b96b9347341c991282f3791d3c79b14))

## [1.1.2](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.1.1...v1.1.2) (2025-10-22)


### Bug Fixes

* update AutoTranslateButtonProps to support list of supported locales with labels ([17121df](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/17121df1a37b4d01ac3c4c7db16dd0e8b88a8266))

## [1.1.1](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.1.0...v1.1.1) (2025-10-22)


### Bug Fixes

* update repository URL format and improve package.json structure ([18b7aaf](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/18b7aaf9d57a98ed0048b00831a389e8d70514fd))

# [1.1.0](https://github.com/nielsreijnders/payload-sync-ai-translations/compare/v1.0.0...v1.1.0) (2025-10-22)


### Features

* add semantic-release for dist only ([e499fe4](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/e499fe4014eba54a7e391ee8a88ade42799bc74e))

# 1.0.0 (2025-10-22)


### Bug Fixes

* align dist package exports ([2d0d2d2](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/2d0d2d2812aae911e8c8928334b493e56833fb50))
* flatten dist build output ([cb3a22f](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/cb3a22fb18497914c1da4dacfb2a11fd1a05c47b))


### Features

* implement releases for better versioning ([9cd9cbe](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/9cd9cbe0711a9cac9f51c8c1328656bde5910104))
* initial commit ([5e42a89](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/5e42a899cc7693f3adbec352fad3b43b2cfd4728))
* translate UI text to English and improve error messages ([7bad29d](https://github.com/nielsreijnders/payload-sync-ai-translations/commit/7bad29d5f15145a340f21c3722a2f369c4f62576))
