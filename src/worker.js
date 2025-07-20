export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/run" && request.method === "GET") {
      const result = await handleTurnUpdate();
      return new Response(result, { status: 200 });
    }
    return new Response("Unsupported method", { status: 405 });
  },

  async scheduled(event, env, ctx) {
    await handleTurnUpdate(); // 定时任务入口
  }
};

async function handleTurnUpdate() {
  const turnUrl = "https://rtc.live.cloudflare.com/v1/turn/keys/7fa7ceaf02944aff9226ab0fcaad0555/credentials/generate";
  const authToken = "Bearer 51cc161512bf5590d02a6977cc19f880ac140ab22ccd44e15381397cc330c3b5";

  // 获取 TURN 信息
  let username = "", credential = "";
  try {
    const turnResp = await fetch(turnUrl, {
      method: "POST",
      headers: {
        "Authorization": authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (turnResp.status !== 201) {
      return `❌ 获取TURN失败: ${turnResp.status}`;
    }
    const turnData = await turnResp.json();
    username = turnData.iceServers.username;
    credential = turnData.iceServers.credential;
  } catch (e) {
    return `❌ 异常: ${e.message}`;
  }

  // 只有成功获取到TURN信息才继续执行后续操作
  try {
    // 添加新记录
    const now = new Date();
    const remark = `${now.getMonth() + 1}.${now.getDate()}`;
    await fetch("https://houtai.yunkefu.pro/add_sdk_info/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "cf",
        data: {
          appid: username,
          certificate: credential,
          remark: remark,
          status: "已启用",
          cookies: ""
        }
      })
    });

    // 查询全部 cf 渠道账号
    const searchResp = await fetch("https://houtai.yunkefu.pro/search_sdk_info/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "cf" })
    });

    const searchData = await searchResp.json();
    const all = searchData.data || [];
    // 把非username的appid取出
    const toDeleteList = all.filter(item => item.appid !== username);

    // 批量删除旧凭证
    if (toDeleteList.length > 0) {
      const appidsToDelete = toDeleteList.map(item => item.appid);
      await fetch("https://houtai.yunkefu.pro/del_sdk_info/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "cf",
          appids: appidsToDelete
        })
      });
    }

    return "✅ TURN 信息更新完成";
  } catch (e) {
    return `❌ 后续操作失败: ${e.message}`;
  }
}