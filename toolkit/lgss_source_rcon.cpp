// LGSS SCUM Server Manager — Public C++17 Source RCON Wire Protocol Header
// Copyright (c) 2026 Legendary Gaming (4UR3X).
//
// Header-only C++17 packet serializer and Winsock2 client helper for external
// native C++ monitoring agents communicating with SCUM Native Source RCON.

#pragma once

#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#endif

namespace lgss::rcon {

enum class PacketType : int32_t {
    ResponseValue = 0,
    ExecCommand   = 2,
    AuthResponse  = 2,
    AuthRequest   = 3,
};

struct RconFrame {
    int32_t     requestId = 0;
    PacketType  type      = PacketType::ResponseValue;
    std::string payload;

    [[nodiscard]] std::vector<uint8_t> serialize() const {
        const int32_t bodyLen = static_cast<int32_t>(payload.size());
        const int32_t packetSize = 4 + 4 + bodyLen + 2;
        std::vector<uint8_t> buffer(static_cast<size_t>(4 + packetSize), 0);

        const int32_t rawType = static_cast<int32_t>(type);
        std::memcpy(buffer.data() + 0, &packetSize, sizeof(int32_t));
        std::memcpy(buffer.data() + 4, &requestId, sizeof(int32_t));
        std::memcpy(buffer.data() + 8, &rawType, sizeof(int32_t));
        if (bodyLen > 0) {
            std::memcpy(buffer.data() + 12, payload.data(), static_cast<size_t>(bodyLen));
        }
        return buffer;
    }

    static RconFrame makeAuth(const std::string& password, int32_t id = 10) {
        return RconFrame{id, PacketType::AuthRequest, password};
    }

    static RconFrame makeCommand(const std::string& command, int32_t id = 20) {
        return RconFrame{id, PacketType::ExecCommand, command};
    }

    static RconFrame makeSentinel(int32_t id = 21) {
        return RconFrame{id, PacketType::ResponseValue, ""};
    }
};

inline std::string formatTargetedSpawnItem(
    const std::string& itemCode,
    int32_t quantity,
    const std::string& steamId64
) {
    if (itemCode.empty() || steamId64.size() < 15) {
        throw std::invalid_argument("Explicit itemCode and 17-digit SteamID64 are required.");
    }
    const int32_t safeQty = quantity < 1 ? 1 : (quantity > 50 ? 50 : quantity);
    return "#SpawnItem " + itemCode + " " + std::to_string(safeQty) + " Location " + steamId64;
}

#ifdef _WIN32
class WinSockRconSession {
public:
    WinSockRconSession() = default;
    ~WinSockRconSession() { disconnect(); }

    WinSockRconSession(const WinSockRconSession&) = delete;
    WinSockRconSession& operator=(const WinSockRconSession&) = delete;

    bool connectAndAuth(const char* host, uint16_t port, const std::string& password, DWORD timeoutMs = 5000) {
        disconnect();
        WSADATA wsa{};
        if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
            return false;
        }
        wsaStarted_ = true;

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(port);
        if (inet_pton(AF_INET, host, &addr.sin_addr) != 1) {
            return false;
        }

        sock_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (sock_ == INVALID_SOCKET) {
            return false;
        }
        setsockopt(sock_, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));
        setsockopt(sock_, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));

        if (connect(sock_, reinterpret_cast<const sockaddr*>(&addr), sizeof(addr)) != 0) {
            disconnect();
            return false;
        }

        auto authBytes = RconFrame::makeAuth(password, 10).serialize();
        if (!sendAll(authBytes.data(), static_cast<int>(authBytes.size()))) {
            disconnect();
            return false;
        }

        int32_t respId = -1;
        int32_t respType = 0;
        std::string body;
        for (int i = 0; i < 3; ++i) {
            if (!readFrame(respId, respType, body)) {
                disconnect();
                return false;
            }
            if (respType == static_cast<int32_t>(PacketType::AuthResponse)) {
                return respId != -1;
            }
        }
        disconnect();
        return false;
    }

    void disconnect() noexcept {
        if (sock_ != INVALID_SOCKET) {
            closesocket(sock_);
            sock_ = INVALID_SOCKET;
        }
        if (wsaStarted_) {
            WSACleanup();
            wsaStarted_ = false;
        }
    }

private:
    bool sendAll(const uint8_t* buf, int total) {
        int sent = 0;
        while (sent < total) {
            int n = send(sock_, reinterpret_cast<const char*>(buf + sent), total - sent, 0);
            if (n <= 0) return false;
            sent += n;
        }
        return true;
    }

    bool readExact(uint8_t* out, int total) {
        int got = 0;
        while (got < total) {
            int n = recv(sock_, reinterpret_cast<char*>(out + got), total - got, 0);
            if (n <= 0) return false;
            got += n;
        }
        return true;
    }

    bool readFrame(int32_t& outId, int32_t& outType, std::string& outBody) {
        int32_t len = 0;
        if (!readExact(reinterpret_cast<uint8_t*>(&len), 4) || len < 10 || len > 131072) {
            return false;
        }
        std::vector<uint8_t> buf(static_cast<size_t>(len));
        if (!readExact(buf.data(), len)) {
            return false;
        }
        std::memcpy(&outId, buf.data(), 4);
        std::memcpy(&outType, buf.data() + 4, 4);
        outBody.assign(reinterpret_cast<const char*>(buf.data() + 8), static_cast<size_t>(len - 10));
        return true;
    }

    SOCKET sock_ = INVALID_SOCKET;
    bool   wsaStarted_ = false;
};
#endif

} // namespace lgss::rcon
