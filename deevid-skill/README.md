# @deevid-ai/deevid-cli

Command-line client for DeeVid OpenAPI media workflows.

This package exposes the `deevid` executable and is also bundled with the DeeVid Codex skill in the [deevid-skills](https://github.com/deevid-dev/deevid-skills) repository.

## Install

```bash
npm install -g @deevid-ai/deevid-cli
```

Configure your DeeVid OpenAPI key:

```bash
export DEEVID_API_KEY="your_deevid_openapi_key"
```

Verify the CLI:

```bash
deevid --version
```

## Examples

Generate an image and print the final URL:

```bash
deevid run image --model "Nano Banana Pro" --prompt "A cinematic coffee product shot" --format url
```

Generate an Avatar V3 video:

```bash
deevid run avatar \
  --avatar-id "171" \
  --avatar-name "Professional Male" \
  --avatar-cover-image "https://..." \
  --voice-id "ttv-voice-xxx" \
  --voice-name "My Voice" \
  --voice-language "en-US" \
  --tts-content "Hello world" \
  --resolution 720p \
  --size SIXTEEN_BY_NINE \
  --model-version "Quality V2.0" \
  --format url
```

## Codex Skill

The npm package includes `SKILL.md`, but normal Codex skill installation should use the full repository or release zip:

```bash
git clone https://github.com/deevid-dev/deevid-skills.git
mkdir -p ~/.codex/skills
cp -R deevid-skills/deevid-skill ~/.codex/skills/
```

## License

This project is licensed under the MIT License.

Copyright © 2026 deevid-dev
