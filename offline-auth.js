(function () {
  const lib = window.supabase;
  if (!lib || typeof lib.createClient !== "function") return;

  function savedSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && /^sb-.*-auth-token$/.test(key)) {
          const s = JSON.parse(localStorage.getItem(key));
          if (s && s.user && s.refresh_token) return s;
        }
      }
    } catch (e) {}
    return null;
  }

  window.supabase = Object.assign({}, lib, {
    createClient: function () {
      const client = lib.createClient.apply(lib, arguments);
      const auth = client.auth;

      const getSession = auth.getSession.bind(auth);
      auth.getSession = async function () {
        const result = await getSession();
        if (result && result.data && result.data.session) return result;
        if (navigator.onLine === false) {
          const s = savedSession();
          if (s) return { data: { session: s }, error: null };
        }
        return result;
      };

      const onChange = auth.onAuthStateChange.bind(auth);
      auth.onAuthStateChange = function (callback) {
        return onChange(function (event, session) {
          if (!session && navigator.onLine === false && event === "INITIAL_SESSION") {
            const s = savedSession();
            if (s) return callback(event, s);
          }
          return callback(event, session);
        });
      };

      return client;
    }
  });
})();
