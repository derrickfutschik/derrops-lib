cloudflared tunnel create dev-8080-local     
cloudflared tunnel route dns dev-8080-local dersza.com
cloudflared tunnel route dns dev-8080-local www.dersza.com
cloudflared tunnel run dev-8080-local