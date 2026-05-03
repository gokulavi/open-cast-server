// ============================================================
// lib/services/agora_service.dart
// Agora RTC service - fetches tokens from your backend server
// ============================================================

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:http/http.dart' as http;

class AgoraService {
  // ── Config ─────────────────────────────────────────────
  // Replace with your Railway server URL after deployment
  static const String serverUrl = 'https://YOUR-APP.up.railway.app';

  // Your Agora App ID (from console.agora.io)
  // This is public-safe (App ID alone can't do harm, Certificate must stay secret on server)
  static const String appId = 'YOUR_AGORA_APP_ID';

  // ── State ──────────────────────────────────────────────
  RtcEngine? _engine;
  bool _isInitialized = false;

  final List<int> _remoteUids = [];
  List<int> get remoteUids => List.unmodifiable(_remoteUids);

  // Callbacks
  Function(int uid)? onUserJoined;
  Function(int uid)? onUserLeft;
  Function(String error)? onError;
  Function()? onJoinSuccess;

  // ── Token fetching ─────────────────────────────────────

  /// Fetch an RTC token from your backend server
  Future<String?> fetchToken({
    required String channel,
    required int uid,
    required String role, // 'publisher' or 'subscriber'
  }) async {
    try {
      final uri = Uri.parse('$serverUrl/api/token/rtc').replace(
        queryParameters: {
          'channel': channel,
          'uid': uid.toString(),
          'role': role,
        },
      );

      final response = await http.get(uri).timeout(
        const Duration(seconds: 10),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['token'] as String?;
      } else {
        debugPrint('Token fetch failed: ${response.statusCode} ${response.body}');
        return null;
      }
    } catch (e) {
      debugPrint('Token fetch error: $e');
      return null;
    }
  }

  // ── Engine initialization ──────────────────────────────

  Future<bool> initialize() async {
    if (_isInitialized) return true;

    // Request camera and microphone permissions
    final cameraStatus = await Permission.camera.request();
    final micStatus = await Permission.microphone.request();

    if (cameraStatus != PermissionStatus.granted ||
        micStatus != PermissionStatus.granted) {
      onError?.call('Camera and microphone permissions are required');
      return false;
    }

    try {
      _engine = createAgoraRtcEngine();

      await _engine!.initialize(RtcEngineContext(
        appId: appId,
        channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
      ));

      // Register event handlers
      _engine!.registerEventHandler(RtcEngineEventHandler(
        onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
          debugPrint('✅ Joined channel: ${connection.channelId}, uid: ${connection.localUid}');
          onJoinSuccess?.call();
        },
        onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
          debugPrint('👤 User joined: $remoteUid');
          _remoteUids.add(remoteUid);
          onUserJoined?.call(remoteUid);
        },
        onUserOffline: (RtcConnection connection, int remoteUid, UserOfflineReasonType reason) {
          debugPrint('👋 User left: $remoteUid');
          _remoteUids.remove(remoteUid);
          onUserLeft?.call(remoteUid);
        },
        onError: (ErrorCodeType err, String msg) {
          debugPrint('❌ Agora error: $err - $msg');
          onError?.call('Streaming error: $msg');
        },
        onTokenPrivilegeWillExpire: (RtcConnection connection, String token) {
          debugPrint('⚠️ Token expiring, should refresh');
          // TODO: refresh token here
        },
      ));

      await _engine!.enableVideo();
      _isInitialized = true;
      debugPrint('✅ Agora engine initialized');
      return true;
    } catch (e) {
      debugPrint('❌ Agora init error: $e');
      onError?.call('Failed to initialize streaming: $e');
      return false;
    }
  }

  // ── Join as Publisher (streamer) ───────────────────────

  Future<bool> joinAsPublisher({
    required String channel,
    required int uid,
  }) async {
    if (!_isInitialized) {
      final success = await initialize();
      if (!success) return false;
    }

    try {
      // Fetch token from your server
      final token = await fetchToken(
        channel: channel,
        uid: uid,
        role: 'publisher',
      );

      if (token == null) {
        onError?.call('Could not get streaming token. Is the server running?');
        return false;
      }

      // Set client role to broadcaster
      await _engine!.setClientRole(role: ClientRoleType.clientRoleBroadcaster);

      // Start preview
      await _engine!.startPreview();

      // Join channel
      await _engine!.joinChannel(
        token: token,
        channelId: channel,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          publishCameraTrack: true,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: false,
          autoSubscribeVideo: false,
        ),
      );

      return true;
    } catch (e) {
      debugPrint('❌ Join as publisher error: $e');
      onError?.call('Failed to start stream: $e');
      return false;
    }
  }

  // ── Join as Subscriber (viewer) ────────────────────────

  Future<bool> joinAsSubscriber({
    required String channel,
    required int uid,
  }) async {
    if (!_isInitialized) {
      final success = await initialize();
      if (!success) return false;
    }

    try {
      final token = await fetchToken(
        channel: channel,
        uid: uid,
        role: 'subscriber',
      );

      if (token == null) {
        onError?.call('Could not get viewing token. Is the server running?');
        return false;
      }

      await _engine!.setClientRole(role: ClientRoleType.clientRoleAudience);

      await _engine!.joinChannel(
        token: token,
        channelId: channel,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleAudience,
          publishCameraTrack: false,
          publishMicrophoneTrack: false,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        ),
      );

      return true;
    } catch (e) {
      debugPrint('❌ Join as subscriber error: $e');
      onError?.call('Failed to join stream: $e');
      return false;
    }
  }

  // ── Video views ────────────────────────────────────────

  /// Local camera preview widget (for the streamer)
  Widget localVideoView() {
    if (_engine == null) return const SizedBox.shrink();
    return AgoraVideoView(
      controller: VideoViewController(
        rtcEngine: _engine!,
        canvas: const VideoCanvas(uid: 0),
      ),
    );
  }

  /// Remote video view (for viewers watching a specific uid)
  Widget remoteVideoView(int remoteUid, String channel) {
    if (_engine == null) return const SizedBox.shrink();
    return AgoraVideoView(
      controller: VideoViewController.remote(
        rtcEngine: _engine!,
        canvas: VideoCanvas(uid: remoteUid),
        connection: RtcConnection(channelId: channel),
      ),
    );
  }

  // ── Controls ───────────────────────────────────────────

  Future<void> toggleMicrophone(bool muted) async {
    await _engine?.muteLocalAudioStream(muted);
  }

  Future<void> toggleCamera(bool disabled) async {
    await _engine?.muteLocalVideoStream(disabled);
  }

  Future<void> switchCamera() async {
    await _engine?.switchCamera();
  }

  // ── Leave & dispose ────────────────────────────────────

  Future<void> leaveChannel() async {
    await _engine?.leaveChannel();
    _remoteUids.clear();
    debugPrint('Left channel');
  }

  Future<void> dispose() async {
    await leaveChannel();
    await _engine?.release();
    _engine = null;
    _isInitialized = false;
    debugPrint('Agora engine disposed');
  }
}
