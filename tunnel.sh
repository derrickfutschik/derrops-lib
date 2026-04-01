TUNNEL_NAME=imac-8080
tunnel create $TUNNEL_NAME 2>/dev/null || true && cloudflared tunnel route dns $TUNNEL_NAME imac.dersza.com && cloudflared tunnel run $TUNNEL_NAME
