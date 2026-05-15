#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

const pkg = require('../package.json');

const CLIENT_SOURCE = 'deevid-skill';

const ENDPOINTS = {
  image: '/v1/open-api/image/task/submit',
  'image-video': '/v1/open-api/image-video/task/submit',
  'text-video': '/v1/open-api/text-video/task/submit',
  'image-edit': '/v1/open-api/image-edit/task/submit',
  'video-edit': '/v1/open-api/video-edit/task/submit',
  music: '/v1/open-api/music/task/submit',
  tts: '/v1/open-api/speech/task/submit',
  avatar: '/v1/open-api/avatar-video/task/submit',
  'product-video': '/v1/open-api/product-video/task/submit',
};

const MODEL_ENDPOINTS = {
  image: '/v1/open-api/image/models',
  'image-video': '/v1/open-api/image-video/models',
  'text-video': '/v1/open-api/text-video/models',
  'video-edit': '/v1/open-api/video-edit/models',
  music: '/v1/open-api/music/models',
  tts: '/v1/open-api/speech/models',
};

const SUBMIT_FIELDS = {
  model: 'model',
  mode: 'mode',
  prompt: 'prompt',
  text: 'text',
  lyrics: 'lyrics',
  style: 'style',
  'tts-content': 'ttsContent',
  'user-image-id': 'userImageId',
  'user-image-ids': 'userImageIds',
  'reference-image-ids': 'referenceImageIds',
  'end-frame-image-id': 'endFrameImageId',
  'original-image-id': 'originalImageId',
  'edited-image-id': 'editedImageId',
  'user-video-id': 'userVideoId',
  'audio-id': 'audioId',
  'template-id': 'templateId',
  'voice-id': 'voiceId',
  'voice-name': 'voiceName',
  'voice-language': 'voiceLanguage',
  'avatar-id': 'avatarId',
  'avatar-name': 'avatarName',
  'avatar-cover-image': 'avatarCoverImage',
  'model-version': 'modelVersion',
  'video-model': 'videoModel',
  'is-private': 'isPrivate',
  'ai-prompt-enhance': 'aiPromptEnhance',
  'generate-audio': 'generateAudio',
  size: 'size',
  resolution: 'resolution',
  duration: 'duration',
  count: 'count',
  speed: 'speed',
  pitch: 'pitch',
  volume: 'volume',
  instrumental: 'instrumental',
};

const NUMBER_FIELDS = new Set([
  'userImageId',
  'endFrameImageId',
  'originalImageId',
  'editedImageId',
  'userVideoId',
  'audioId',
  'templateId',
  'duration',
  'count',
  'speed',
  'pitch',
  'volume',
]);

const INT_LIST_FIELDS = new Set(['userImageIds', 'referenceImageIds']);

const BOOLEAN_FIELDS = new Set(['isPrivate', 'aiPromptEnhance', 'generateAudio', 'instrumental']);

const AVATAR_MODEL_VERSIONS = ['Quality V2.0', 'Quality V1.0', 'Lite V1.0'];
const AVATAR_V3_MODEL_VERSION = 'Quality V2.0';
const VIDEO_SIZES = [
  'SIXTEEN_BY_NINE',
  'NINE_BY_SIXTEEN',
  'ONE_BY_ONE',
  'FOUR_BY_THREE',
  'THREE_BY_FOUR',
  'TWENTY_ONE_BY_NINE',
  'NINE_BY_TWENTY_ONE',
];
const AVATAR_V3_VIDEO_SIZES = ['SIXTEEN_BY_NINE', 'NINE_BY_SIXTEEN'];
const VIDEO_RESOLUTIONS = ['720p', '1080p'];

function main() {
  run(process.argv.slice(2)).catch(error => {
    if (error && error.exitCode) {
      if (error.message) console.error(error.message);
      process.exit(error.exitCode);
    }
    console.error(error?.message || String(error));
    process.exit(1);
  });
}

async function run(argv) {
  const command = argv[0];
  if (!command || command === '-h' || command === '--help') {
    printHelp();
    return;
  }
  if (command === '-v' || command === '--version' || command === 'version') {
    console.log(pkg.version);
    return;
  }

  const rest = argv.slice(1);
  if (command === 'models') return cmdModels(rest);
  if (command === 'submit') return cmdSubmit(rest);
  if (command === 'run') return cmdRun(rest);
  if (command === 'wait') return cmdWait(rest);
  if (command === 'result') return cmdResult(rest);
  if (command === 'upload') return cmdUpload(rest);
  if (command === 'avatar') return cmdAvatar(rest);
  if (command === 'voice-clone') return cmdVoiceClone(rest);
  if (command === 'quota') return cmdQuota(rest);
  if (command === 'tasks') return cmdTasks(rest);
  if (command === 'usage') return cmdUsage(rest);
  if (command === 'webhook') return cmdWebhook(rest);
  if (command === 'api') return cmdApi(rest);

  fail(`Unknown command: ${command}\nRun: deevid --help`);
}

function printHelp() {
  console.log(`DeeVid OpenAPI CLI ${pkg.version}

Usage:
  deevid run <type> [options]          Submit and wait until SUCCESS/FAIL
  deevid submit <type> [options]       Submit a task and print taskId
  deevid wait <taskId> [options]       Poll task status
  deevid result <taskId> [options]     Print result URL(s)
  deevid models <type>                 List available models
  deevid upload <file> [options]       Upload image/audio/video assets
  deevid avatar <subcommand> [options] Avatar and voice helpers
  deevid voice-clone <subcommand>      Voice clone helpers
  deevid quota                         Show remaining quota
  deevid tasks [options]               List submitted tasks
  deevid usage [options]               Show API usage statistics
  deevid webhook <test|logs>           Test webhook or list delivery logs
  deevid api <METHOD> <path>           Raw DEEVID_API_KEY OpenAPI request

Common task types:
  image, image-video, text-video, image-edit, video-edit, music, tts, avatar, product-video

Examples:
  deevid run image --model "Nano Banana Pro" --prompt "A cat" --format url
  deevid submit text-video --model "Quality V2.0" --prompt "Sunset" --size SIXTEEN_BY_NINE
  deevid wait 10001 --interval 10 --timeout 0 --format url
  deevid upload ./ref.png
  deevid quota
  deevid tasks --status PROCESSING

Environment:
  DEEVID_API_KEY   required
  DEEVID_API_BASE  optional, defaults to https://api.vidfun.ai
`);
}

async function cmdModels(argv) {
  const type = argv[0];
  if (!MODEL_ENDPOINTS[type]) fail(`Unsupported models type: ${type}`);
  const data = await apiGet(MODEL_ENDPOINTS[type]);
  printJson({ type, models: data });
}

async function cmdSubmit(argv) {
  const { type, body, opts } = parseSubmit(argv);
  validateSubmit(type, body, opts);
  if (opts.dryRun) {
    printJson({ endpoint: ENDPOINTS[type], body: withClientSource(body) });
    return;
  }
  const data = await apiPost(ENDPOINTS[type], body);
  printJson({
    type,
    taskId: data?.taskId,
    status: data?.status,
  });
}

async function cmdRun(argv) {
  const { type, body, opts } = parseSubmit(argv);
  validateSubmit(type, body, opts);
  if (opts.dryRun) {
    printJson({ endpoint: ENDPOINTS[type], body: withClientSource(body), run: true });
    return;
  }
  const submitData = await apiPost(ENDPOINTS[type], body);
  const taskId = submitData?.taskId;
  if (!taskId) fail(`Submit succeeded but taskId is missing: ${JSON.stringify(submitData)}`);
  await waitTask(taskId, {
    interval: numberOpt(opts.interval, defaultInterval(type)),
    timeout: numberOpt(opts.timeout, 0),
    once: false,
    quiet: Boolean(opts.quiet),
    format: opts.format || 'url',
  });
}

async function cmdWait(argv) {
  const { positionals, opts } = parseArgs(argv);
  const taskId = parseInt(positionals[0], 10);
  if (!Number.isFinite(taskId)) fail('wait requires taskId');
  await waitTask(taskId, {
    interval: numberOpt(opts.interval, 8),
    timeout: numberOpt(opts.timeout, 0),
    once: Boolean(opts.once),
    quiet: Boolean(opts.quiet),
    format: opts.format || 'json',
  });
}

async function cmdResult(argv) {
  const { positionals, opts } = parseArgs(argv);
  const format = opts.format || 'json';
  if (opts.urls) {
    const urls = splitList(opts.urls);
    emitResult({ sourceUrls: urls }, format);
    return;
  }
  const taskId = parseInt(positionals[0], 10);
  if (!Number.isFinite(taskId)) fail('result requires taskId or --urls');
  const data = await apiGet(`/v1/open-api/task/status?taskId=${encodeURIComponent(taskId)}`);
  const out = emitResult(data, data?.status === 'SUCCESS' ? format : 'json');
  if (data?.status !== 'SUCCESS') fail(`Task is not successful yet (status=${data?.status}). Use deevid wait ${taskId}.`, 1);
  if (!out.urlLines?.length) fail('Task succeeded but no public result URL was found.');
}

async function waitTask(taskId, options) {
  const deadline = options.timeout > 0 ? Date.now() + options.timeout * 1000 : null;
  while (true) {
    const data = await apiGet(`/v1/open-api/task/status?taskId=${encodeURIComponent(taskId)}`);
    const status = data?.status;
    if (options.once) {
      emitResult(data, options.format);
      return;
    }
    if (status === 'SUCCESS') {
      emitResult(data, options.format);
      return;
    }
    if (status === 'FAIL') {
      emitResult(data, 'json');
      process.exit(2);
    }
    if (!options.quiet) {
      const step = data?.progress?.currentStep || '';
      console.error(`[${Math.floor(Date.now() / 1000)}] taskId=${taskId} status=${status} ${step}`.trim());
    }
    if (deadline && Date.now() >= deadline) {
      emitResult({ timeout: true, ...data }, 'json');
      process.exit(3);
    }
    await sleep(options.interval * 1000);
  }
}

async function cmdUpload(argv) {
  const { positionals, opts } = parseArgs(argv);
  const filePath = positionals[0];
  if (!filePath) fail('upload requires file path');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) fail(`File not found: ${filePath}`);
  const kind = opts.kind || detectKind(filePath);
  if (!['image', 'audio', 'video'].includes(kind)) fail(`Cannot detect file type. Use --kind image|audio|video`);

  let out;
  if (kind === 'image') out = await uploadImage(filePath, opts);
  else if (kind === 'audio') out = await uploadAudio(filePath, opts);
  else out = await uploadVideo(filePath, opts);
  printJson(out);
}

async function uploadImage(filePath, opts) {
  const mime = guessMime(filePath, 'image');
  const presign = await apiPost('/v1/open-api/file-upload/presign/image', { mimeType: mime });
  await putBinary(presign.presignedUrl, filePath, mime);
  const [width, height] = resolveDims(filePath, opts, 'image');
  const confirm = await apiPost('/v1/open-api/file-upload/confirm/image', {
    fileName: presign.fileName,
    width,
    height,
  });
  return {
    kind: 'image',
    userImageId: confirm.userImageId,
    imageUrl: confirm.imageUrl,
    width,
    height,
    fileName: presign.fileName,
  };
}

async function uploadAudio(filePath, opts) {
  if (path.extname(filePath).toLowerCase() !== '.mp3') fail('OpenAPI audio upload currently supports mp3 only.');
  const presign = await apiPost('/v1/open-api/file-upload/presign/audio', {});
  await putBinary(presign.presignedUrl, filePath, 'audio/mp3');
  const duration = opts.duration !== undefined ? Number(opts.duration) : ffprobeDuration(filePath);
  if (!Number.isFinite(duration) || duration <= 0) {
    fail('Cannot determine audio duration. Install ffprobe or pass --duration seconds.');
  }
  const confirm = await apiPost('/v1/open-api/file-upload/confirm/audio', {
    fileName: presign.fileName,
    duration,
  });
  return {
    kind: 'audio',
    audioId: confirm.audioId,
    audioName: confirm.audioName,
    duration,
    fileName: presign.fileName,
  };
}

async function uploadVideo(filePath, opts) {
  const mime = guessMime(filePath, 'video');
  const presign = await apiPost('/v1/open-api/file-upload/presign/video', { mimeType: mime });
  await putBinary(presign.presignedUrl, filePath, mime);
  const [width, height] = resolveDims(filePath, opts, 'video');
  const confirm = await apiPost('/v1/open-api/file-upload/confirm/video', {
    fileName: presign.fileName,
    width,
    height,
  });
  const userVideoId = confirm.userVideoId;
  const transcodeTaskId = confirm.transcodeTaskId;
  let transcodeStatus = 'skipped';
  let resultVideoName = null;
  if (transcodeTaskId && !opts.skipTranscode) {
    const deadline = Date.now() + numberOpt(opts.transcodeTimeout, 180) * 1000;
    transcodeStatus = 'PROCESSING';
    while (Date.now() < deadline) {
      const status = await apiGet(`/v1/open-api/file-upload/video/transcode?taskId=${encodeURIComponent(transcodeTaskId)}`);
      transcodeStatus = status.status || 'PROCESSING';
      if (transcodeStatus === 'SUCCESS') {
        resultVideoName = status.resultVideoName || null;
        break;
      }
      if (transcodeStatus === 'FAIL') fail(`Video transcode failed, taskId=${transcodeTaskId}`);
      await sleep(numberOpt(opts.transcodeInterval, 5) * 1000);
    }
    if (transcodeStatus !== 'SUCCESS') {
      console.error(`Warning: video transcode timeout; userVideoId=${userVideoId} may still be processing.`);
    }
  }
  return {
    kind: 'video',
    userVideoId,
    videoUrl: confirm.videoUrl,
    duration: confirm.duration,
    width,
    height,
    transcodeTaskId,
    transcodeStatus,
    resultVideoName,
    fileName: presign.fileName,
  };
}

async function cmdAvatar(argv) {
  const sub = argv[0];
  const { positionals, opts } = parseArgs(argv.slice(1));
  if (sub === 'avatars') {
    const data = await apiGet(`/v1/open-api/avatars?${query({ page: opts.page || 1, pageSize: opts.pageSize || opts['page-size'] || 20 })}`);
    printJson({ avatars: data });
    return;
  }
  if (sub === 'voices') {
    const params = { page: opts.page || 1, pageSize: opts.pageSize || opts['page-size'] || 20 };
    if (opts.language) params.language = opts.language;
    const data = await apiGet(`/v1/open-api/voices?${query(params)}`);
    printJson({ voices: data });
    return;
  }
  if (sub === 'create-group') {
    const body = { groupName: required(opts.groupName || opts['group-name'], '--group-name') };
    if (opts.userImageId || opts['user-image-id']) body.userImageId = Number(opts.userImageId || opts['user-image-id']);
    else if (opts.userImageIds || opts['user-image-ids']) body.userImageIds = parseIntList(opts.userImageIds || opts['user-image-ids']);
    else fail('create-group requires --user-image-id or --user-image-ids');
    printJson(await apiPost('/v1/open-api/avatar-groups', body));
    return;
  }
  if (sub === 'list-groups') {
    const data = await apiGet(`/v1/open-api/avatar-groups?${query({ page: opts.page || 1, pageSize: opts.pageSize || opts['page-size'] || 20 })}`);
    printJson({ groups: data });
    return;
  }
  if (sub === 'list-looks') {
    const params = {};
    if (opts.groupId || opts['group-id']) params.groupId = opts.groupId || opts['group-id'];
    if (opts.avatarId || opts['avatar-id']) params.avatarId = opts.avatarId || opts['avatar-id'];
    if (!Object.keys(params).length) fail('list-looks requires --group-id or --avatar-id');
    const data = await apiGet(`/v1/open-api/avatar-groups/looks?${query(params)}`);
    printJson({ looks: data });
    return;
  }
  if (sub === 'append-looks') {
    const groupId = required(opts.groupId || opts['group-id'], '--group-id');
    const userImageIds = required(opts.userImageIds || opts['user-image-ids'], '--user-image-ids');
    printJson(await apiPost(`/v1/open-api/avatar-groups/${encodeURIComponent(groupId)}/looks`, {
      userImageIds: parseIntList(userImageIds),
    }));
    return;
  }
  if (sub === 'delete-group') {
    const groupId = required(opts.groupId || opts['group-id'], '--group-id');
    printJson(await apiDelete(`/v1/open-api/avatar-groups/${encodeURIComponent(groupId)}`));
    return;
  }
  if (sub === 'delete-look') {
    const groupId = required(opts.groupId || opts['group-id'], '--group-id');
    const avatarId = required(opts.avatarId || opts['avatar-id'], '--avatar-id');
    printJson(await apiDelete(`/v1/open-api/avatar-groups/${encodeURIComponent(groupId)}/looks/${encodeURIComponent(avatarId)}`));
    return;
  }
  fail(`Unknown avatar subcommand: ${sub || ''}`);
}

async function cmdVoiceClone(argv) {
  const sub = argv[0];
  const { positionals, opts } = parseArgs(argv.slice(1));
  if (sub === 'create') {
    const body = cleanObject({
      cloneType: opts.cloneType || opts['clone-type'],
      audioName: opts.audioName || opts['audio-name'],
      id: opts.id !== undefined ? Number(opts.id) : undefined,
      voiceId: opts.voiceId || opts['voice-id'],
      name: required(opts.name, '--name'),
      gender: opts.gender,
      language: opts.language,
    });
    if (opts.dryRun) return printJson({ method: 'POST', endpoint: '/v1/open-api/voice-clone', body: withClientSource(body) });
    printJson(await apiPost('/v1/open-api/voice-clone', body));
    return;
  }
  if (sub === 'list') {
    const params = cleanObject({
      limit: opts.limit,
      cursor: opts.cursor,
      status: opts.status,
    });
    printJson(await apiGet(`/v1/open-api/voice-clone?${query(params)}`));
    return;
  }
  if (sub === 'get') {
    const id = required(positionals[0] || opts.id, 'voice clone id');
    printJson(await apiGet(`/v1/open-api/voice-clone/${encodeURIComponent(id)}`));
    return;
  }
  if (sub === 'rename') {
    const id = required(positionals[0] || opts.id, 'voice clone id');
    const body = {
      name: required(opts.name, '--name'),
    };
    if (opts.dryRun) return printJson({ method: 'PUT', endpoint: `/v1/open-api/voice-clone/${id}`, body });
    printJson(await apiPut(`/v1/open-api/voice-clone/${encodeURIComponent(id)}`, body));
    return;
  }
  if (sub === 'delete') {
    const id = required(positionals[0] || opts.id, 'voice clone id');
    printJson(await apiDelete(`/v1/open-api/voice-clone/${encodeURIComponent(id)}`));
    return;
  }
  if (sub === 'preview') {
    const body = cleanObject({
      prompt: required(opts.prompt, '--prompt'),
      gender: opts.gender,
      language: opts.language,
    });
    if (opts.dryRun) return printJson({ method: 'POST', endpoint: '/v1/open-api/voice-clone/preview', body: withClientSource(body) });
    printJson(await apiPost('/v1/open-api/voice-clone/preview', body));
    return;
  }
  fail(`Unknown voice-clone subcommand: ${sub || ''}`);
}

async function cmdQuota() {
  printJson(await apiGet('/v1/open-api/quota'));
}

async function cmdTasks(argv) {
  const { opts } = parseArgs(argv);
  const params = cleanObject({
    page: opts.page,
    pageSize: opts.pageSize || opts['page-size'],
    status: opts.status,
  });
  printJson(await apiGet(`/v1/open-api/tasks?${query(params)}`));
}

async function cmdUsage(argv) {
  const { opts } = parseArgs(argv);
  const params = cleanObject({
    startDate: opts.startDate || opts['start-date'],
    endDate: opts.endDate || opts['end-date'],
  });
  printJson(await apiGet(`/v1/open-api/usage?${query(params)}`));
}

async function cmdWebhook(argv) {
  const sub = argv[0];
  const { opts } = parseArgs(argv.slice(1));
  if (sub === 'test') {
    if (opts.dryRun) return printJson({ method: 'POST', endpoint: '/v1/open-api/webhook/test', body: withClientSource({}) });
    printJson(await apiPost('/v1/open-api/webhook/test', {}));
    return;
  }
  if (sub === 'logs') {
    const params = cleanObject({
      page: opts.page,
      pageSize: opts.pageSize || opts['page-size'],
    });
    printJson(await apiGet(`/v1/open-api/webhook/logs?${query(params)}`));
    return;
  }
  fail(`Unknown webhook subcommand: ${sub || ''}. Use test or logs.`);
}

async function cmdApi(argv) {
  const { positionals, opts } = parseArgs(argv);
  const method = String(positionals[0] || '').toUpperCase();
  const apiPath = positionals[1];
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) fail('api requires method GET, POST, PUT, or DELETE');
  if (!apiPath || !apiPath.startsWith('/v1/open-api/')) fail('api path must start with /v1/open-api/');

  let body;
  if (opts.json) {
    try {
      body = JSON.parse(opts.json);
    } catch (e) {
      fail(`--json is not valid JSON: ${e.message}`);
    }
  }
  if (method === 'GET') return printJson(await apiGet(apiPath));
  if (method === 'POST') {
    if (opts.dryRun) return printJson({ method, endpoint: apiPath, body: withClientSource(body || {}) });
    return printJson(await apiPost(apiPath, body || {}));
  }
  if (method === 'PUT') {
    if (opts.dryRun) return printJson({ method, endpoint: apiPath, body: body || {} });
    return printJson(await apiPut(apiPath, body || {}));
  }
  if (method === 'DELETE') return printJson(await apiDelete(apiPath));
}

function parseSubmit(argv) {
  const { positionals, opts } = parseArgs(argv);
  const type = positionals[0] || opts.type;
  if (!ENDPOINTS[type]) fail(`Unsupported task type: ${type}`);
  const body = {};
  for (const [optKey, bodyKey] of Object.entries(SUBMIT_FIELDS)) {
    const raw = opts[optKey] ?? opts[toCamel(optKey)];
    if (raw === undefined) continue;
    if (INT_LIST_FIELDS.has(bodyKey)) body[bodyKey] = parseIntList(raw);
    else if (NUMBER_FIELDS.has(bodyKey)) body[bodyKey] = Number(raw);
    else if (BOOLEAN_FIELDS.has(bodyKey)) body[bodyKey] = boolOpt(raw);
    else body[bodyKey] = raw;
  }
  if (opts.public) body.isPrivate = false;
  if (['avatar', 'product-video'].includes(type) && body.isPrivate === undefined) body.isPrivate = true;
  if (opts.extraJson || opts['extra-json']) {
    let extra;
    try {
      extra = JSON.parse(opts.extraJson || opts['extra-json']);
    } catch (e) {
      fail(`--extra-json is not valid JSON: ${e.message}`);
    }
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) fail('--extra-json must be a JSON object');
    Object.assign(body, extra);
  }
  return { type, body, opts };
}

function validateSubmit(type, body, opts) {
  const knownSilentMaster4 = ['text-video', 'image-video'].includes(type) && String(body.model || '').trim().toLowerCase() === 'master v4.0';
  if (knownSilentMaster4 && (body.generateAudio || opts.requireNativeAudio || opts['require-native-audio'])) {
    fail('Current OpenAPI text-video/image-video Master V4.0 path cannot guarantee native audio.');
  }
  if (type === 'text-video') return requireFields(body, ['model', 'prompt', 'size'], type);
  if (type === 'image') {
    const mode = body.mode || 'text_to_image';
    if (mode === 'text_to_image') return requireFields(body, ['model', 'prompt'], 'image text_to_image');
    if (mode === 'image_to_image') return requireFields(body, ['model', 'prompt', 'userImageIds'], 'image image_to_image');
    if (mode === 'template') return requireFields(body, ['templateId', 'prompt'], 'image template');
    fail(`Unsupported image mode: ${mode}`);
  }
  if (type === 'image-video') {
    if (body.mode === 'start_image') return requireFields(body, ['model', 'userImageId'], 'image-video start_image');
    if (body.mode === 'between_images') return requireFields(body, ['model', 'userImageId', 'endFrameImageId'], 'image-video between_images');
    if (body.mode === 'reference_images') return requireFields(body, ['model', 'userImageId', 'referenceImageIds'], 'image-video reference_images');
    fail('image-video requires --mode start_image / between_images / reference_images');
  }
  if (type === 'image-edit') return requireFields(body, ['originalImageId', 'editedImageId'], type);
  if (type === 'video-edit') return requireFields(body, ['model', 'userVideoId', 'prompt'], type);
  if (type === 'music') return requireFields(body, ['prompt'], type);
  if (type === 'tts') return requireFields(body, ['text'], type);
  if (type === 'avatar') return validateAvatarSubmit(body);
  if (type === 'product-video') return validateProductVideoSubmit(body);
}

function validateAvatarSubmit(body) {
  requireFields(body, ['avatarId', 'avatarName', 'avatarCoverImage', 'resolution', 'modelVersion'], 'avatar');
  validateAvatarModelVersion(body.modelVersion, 'avatar');
  validateAllowed(body.resolution, VIDEO_RESOLUTIONS, 'resolution', 'avatar');
  if (body.size !== undefined) validateAllowed(body.size, VIDEO_SIZES, 'size', 'avatar');

  const hasAudio = hasValue(body.audioId);
  const hasTts = !missing(body, ['voiceId', 'voiceName', 'voiceLanguage', 'ttsContent']).length;
  if (hasAudio && hasTts) fail('avatar custom audio mode and TTS mode cannot be used together');

  if (body.modelVersion === AVATAR_V3_MODEL_VERSION) {
    if (hasAudio) {
      fail('avatar Quality V2.0 supports TTS mode only. Use --tts-content with voice fields, or use Quality V1.0/Lite V1.0 for --audio-id.');
    }
    requireFields(body, ['size', 'voiceId', 'voiceName', 'voiceLanguage', 'ttsContent'], 'avatar Quality V2.0');
    validateAllowed(body.size, AVATAR_V3_VIDEO_SIZES, 'size', 'avatar Quality V2.0');
    if (String(body.ttsContent).length > 500) fail('avatar Quality V2.0 requires ttsContent to be at most 500 characters');
    return;
  }

  if (!hasAudio && !hasTts) {
    fail('avatar requires --audio-id or full --voice-id --voice-name --voice-language --tts-content');
  }
}

function validateProductVideoSubmit(body) {
  requireFields(body, ['avatarId', 'avatarName', 'avatarCoverImage', 'userImageId', 'resolution', 'size', 'modelVersion'], 'product-video');
  validateAvatarModelVersion(body.modelVersion, 'product-video');
  validateAllowed(body.size, VIDEO_SIZES, 'size', 'product-video');
  if (body.resolution !== '1080p') fail('product-video resolution must be 1080p');
  const hasAudio = hasValue(body.audioId);
  const hasTts = !missing(body, ['voiceId', 'voiceName', 'voiceLanguage', 'ttsContent']).length;
  if (hasAudio && hasTts) fail('product-video custom audio mode and TTS mode cannot be used together');
  if (!hasAudio && !hasTts) fail('product-video requires --audio-id or full --voice-id --voice-name --voice-language --tts-content');
}

function validateAvatarModelVersion(value, context) {
  validateAllowed(value, AVATAR_MODEL_VERSIONS, 'modelVersion', context);
}

function validateAllowed(value, allowed, field, context) {
  if (!allowed.includes(value)) fail(`${context} ${field} must be one of: ${allowed.join(', ')}`);
}

function requireFields(body, keys, context) {
  const miss = missing(body, keys);
  if (miss.length) fail(`${context} missing required fields: ${miss.join(', ')}`);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function missing(body, keys) {
  return keys.filter(key => body[key] === undefined || body[key] === null || body[key] === '' || (Array.isArray(body[key]) && body[key].length === 0));
}

function parseArgs(argv) {
  const positionals = [];
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    let key = arg.slice(2);
    let value;
    if (eq >= 0) {
      key = arg.slice(2, eq);
      value = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        value = next;
        i += 1;
      } else {
        value = true;
      }
    }
    opts[key] = value;
    opts[toCamel(key)] = value;
  }
  return { positionals, opts };
}

async function apiGet(apiPath) {
  return unwrap(await requestJson('GET', apiPath));
}

async function apiPost(apiPath, body) {
  return unwrap(await requestJson('POST', apiPath, withClientSource(body)));
}

async function apiPut(apiPath, body) {
  return unwrap(await requestJson('PUT', apiPath, body));
}

async function apiDelete(apiPath) {
  return unwrap(await requestJson('DELETE', apiPath));
}

async function requestJson(method, apiPath, body) {
  ensureAuth();
  const headers = {
    Authorization: `Bearer ${process.env.DEEVID_API_KEY}`,
    Accept: 'application/json',
    'User-Agent': `deevid-skill/${pkg.version}`,
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(apiBase() + apiPath, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API error ${res.status} ${method} ${apiBase() + apiPath}\n${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function unwrap(resp) {
  if (resp && typeof resp === 'object' && Object.prototype.hasOwnProperty.call(resp, 'success')) {
    if (!resp.success) {
      const err = resp.error || {};
      fail(`Business error ${err.code}: ${err.message}`);
    }
    return resp.data || {};
  }
  return resp;
}

function withClientSource(body) {
  return { ...(body || {}), clientSource: CLIENT_SOURCE };
}

function apiBase() {
  return (process.env.DEEVID_API_BASE || 'https://api.vidfun.ai').replace(/\/+$/, '');
}

function ensureAuth() {
  if (!process.env.DEEVID_API_KEY) fail("DEEVID_API_KEY is required. Example: export DEEVID_API_KEY='your-api-key'");
}

function emitResult(data, format) {
  if (format === 'media' || format === 'delivery') format = 'url';
  if (!['json', 'url'].includes(format)) fail(`Unsupported format: ${format}. Use json or url.`);
  const out = withResultUrlFields(data || {});
  if (format === 'url' && out.urlLines?.length) {
    for (const line of out.urlLines) console.log(line);
  } else {
    printJson(out);
  }
  return out;
}

function withResultUrlFields(data) {
  const out = { ...(data || {}) };
  const urls = collectResultUrls(out);
  if (urls.length) {
    out.sourceUrls = urls;
    out.urlLines = urlLines(urls);
  }
  return out;
}

function collectResultUrls(data) {
  const urls = [];
  if (Array.isArray(data.sourceUrls)) urls.push(...data.sourceUrls);
  for (const key of ['resultVideoUrl', 'resultAudioUrl', 'resultImageUrl']) {
    if (data[key]) urls.push(data[key]);
  }
  if (Array.isArray(data.resultImageUrls)) urls.push(...data.resultImageUrls);
  return Array.from(new Set(urls));
}

function urlLines(urls) {
  for (const url of urls) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail(`Result URL must be http(s), got: ${url}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) fail(`Result URL must be http(s), got: ${url}`);
  }
  return urls;
}

function detectKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return 'image';
  if (ext === '.mp3') return 'audio';
  if (['.mp4', '.mov'].includes(ext)) return 'video';
  return null;
}

function guessMime(filePath, kind) {
  const ext = path.extname(filePath).toLowerCase();
  const byExt = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp3': 'audio/mp3',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  };
  return byExt[ext] || (kind === 'image' ? 'image/jpeg' : kind === 'audio' ? 'audio/mp3' : kind === 'video' ? 'video/mp4' : 'application/octet-stream');
}

function readImageDimsPure(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(30);
    fs.readSync(fd, head, 0, 30, 0);
    if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return [head.readUInt32BE(16), head.readUInt32BE(20)];
    }
    if (head.subarray(0, 6).toString('ascii') === 'GIF87a' || head.subarray(0, 6).toString('ascii') === 'GIF89a') {
      return [head.readUInt16LE(6), head.readUInt16LE(8)];
    }
    if (head[0] === 0xff && head[1] === 0xd8) {
      let pos = 2;
      const size = fs.statSync(filePath).size;
      while (pos < size) {
        const markerBuf = Buffer.alloc(4);
        fs.readSync(fd, markerBuf, 0, 4, pos);
        if (markerBuf[0] !== 0xff) {
          pos += 1;
          continue;
        }
        const marker = markerBuf[1];
        const length = markerBuf.readUInt16BE(2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          const dims = Buffer.alloc(4);
          fs.readSync(fd, dims, 0, 4, pos + 5);
          return [dims.readUInt16BE(2), dims.readUInt16BE(0)];
        }
        pos += 2 + length;
      }
    }
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
  return null;
}

function ffprobeDims(filePath) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=,:p=0', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30000,
    }).trim();
    const [w, h] = out.split(',').map(Number);
    return Number.isFinite(w) && Number.isFinite(h) ? [w, h] : null;
  } catch {
    return null;
  }
}

function ffprobeDuration(filePath) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30000,
    }).trim();
    const duration = Number(out);
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

function resolveDims(filePath, opts, label) {
  if (opts.width && opts.height) return [Number(opts.width), Number(opts.height)];
  const dims = readImageDimsPure(filePath) || ffprobeDims(filePath);
  if (!dims) fail(`Cannot determine ${label} dimensions. Install ffprobe or pass --width and --height.`);
  return dims;
}

function putBinary(presignedUrl, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(presignedUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request({
      method: 'PUT',
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fs.statSync(filePath).size,
      },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Upload error ${res.statusCode} PUT ${presignedUrl}\n${Buffer.concat(chunks).toString('utf8')}`));
          return;
        }
        resolve();
      });
    });
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

function parseIntList(value) {
  const values = splitList(value).map(v => Number(v));
  if (values.some(v => !Number.isInteger(v))) fail(`ID list must contain integers: ${value}`);
  return values;
}

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function toCamel(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function defaultInterval(type) {
  if (['image', 'image-edit', 'tts'].includes(type)) return 5;
  if (['text-video', 'image-video', 'music'].includes(type)) return 10;
  return 15;
}

function numberOpt(value, fallback) {
  if (value === undefined || value === null || value === true || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolOpt(value) {
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === false) return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  fail(`Boolean option must be true or false, got: ${value}`);
}

function query(params) {
  return new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();
}

function cleanObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

function required(value, name) {
  if (value === undefined || value === null || value === '') fail(`${name} is required`);
  return value;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function fail(message, exitCode = 1) {
  const err = new Error(message);
  err.exitCode = exitCode;
  throw err;
}

main();
