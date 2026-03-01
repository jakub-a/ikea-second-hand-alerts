// vite.config.js
import { defineConfig } from "file:///Users/jakubandrzejewski/Documents/GitHub/ikea-second-hand-alerts/apps/web/node_modules/vite/dist/node/index.js";
import react from "file:///Users/jakubandrzejewski/Documents/GitHub/ikea-second-hand-alerts/apps/web/node_modules/@vitejs/plugin-react/dist/index.js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
var __vite_injected_original_import_meta_url = "file:///Users/jakubandrzejewski/Documents/GitHub/ikea-second-hand-alerts/apps/web/vite.config.js";
function readAppVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(new URL("./package.json", __vite_injected_original_import_meta_url), "utf8"));
    return packageJson.version || "0.0.0";
  } catch (err) {
    return "0.0.0";
  }
}
function readGitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch (err) {
    return "nogit";
  }
}
function createBuildVersion() {
  const baseVersion = readAppVersion();
  const sha = readGitShortSha();
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
  return `${baseVersion}+${stamp}-${sha}`;
}
var appBuildVersion = process.env.VITE_APP_VERSION || createBuildVersion();
var vite_config_default = defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appBuildVersion)
  },
  server: {
    fs: {
      allow: ["../.."]
    },
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvamFrdWJhbmRyemVqZXdza2kvRG9jdW1lbnRzL0dpdEh1Yi9pa2VhLXNlY29uZC1oYW5kLWFsZXJ0cy9hcHBzL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2pha3ViYW5kcnplamV3c2tpL0RvY3VtZW50cy9HaXRIdWIvaWtlYS1zZWNvbmQtaGFuZC1hbGVydHMvYXBwcy93ZWIvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2pha3ViYW5kcnplamV3c2tpL0RvY3VtZW50cy9HaXRIdWIvaWtlYS1zZWNvbmQtaGFuZC1hbGVydHMvYXBwcy93ZWIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdub2RlOmZzJztcblxuZnVuY3Rpb24gcmVhZEFwcFZlcnNpb24oKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhuZXcgVVJMKCcuL3BhY2thZ2UuanNvbicsIGltcG9ydC5tZXRhLnVybCksICd1dGY4JykpO1xuICAgIHJldHVybiBwYWNrYWdlSnNvbi52ZXJzaW9uIHx8ICcwLjAuMCc7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiAnMC4wLjAnO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWRHaXRTaG9ydFNoYSgpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZXhlY1N5bmMoJ2dpdCByZXYtcGFyc2UgLS1zaG9ydCBIRUFEJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuICdub2dpdCc7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQnVpbGRWZXJzaW9uKCkge1xuICBjb25zdCBiYXNlVmVyc2lvbiA9IHJlYWRBcHBWZXJzaW9uKCk7XG4gIGNvbnN0IHNoYSA9IHJlYWRHaXRTaG9ydFNoYSgpO1xuICBjb25zdCBzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bLTpdL2csICcnKS5yZXBsYWNlKC9cXC4uKyQvLCAnJyk7XG4gIHJldHVybiBgJHtiYXNlVmVyc2lvbn0rJHtzdGFtcH0tJHtzaGF9YDtcbn1cblxuY29uc3QgYXBwQnVpbGRWZXJzaW9uID0gcHJvY2Vzcy5lbnYuVklURV9BUFBfVkVSU0lPTiB8fCBjcmVhdGVCdWlsZFZlcnNpb24oKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICBkZWZpbmU6IHtcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBQX1ZFUlNJT04nOiBKU09OLnN0cmluZ2lmeShhcHBCdWlsZFZlcnNpb24pXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGZzOiB7XG4gICAgICBhbGxvdzogWycuLi8uLiddXG4gICAgfSxcbiAgICBwb3J0OiA1MTczLFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODcnXG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1osU0FBUyxvQkFBb0I7QUFDN2EsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CO0FBSCtOLElBQU0sMkNBQTJDO0FBSzdTLFNBQVMsaUJBQWlCO0FBQ3hCLE1BQUk7QUFDRixVQUFNLGNBQWMsS0FBSyxNQUFNLGFBQWEsSUFBSSxJQUFJLGtCQUFrQix3Q0FBZSxHQUFHLE1BQU0sQ0FBQztBQUMvRixXQUFPLFlBQVksV0FBVztBQUFBLEVBQ2hDLFNBQVMsS0FBSztBQUNaLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFQSxTQUFTLGtCQUFrQjtBQUN6QixNQUFJO0FBQ0YsV0FBTyxTQUFTLDhCQUE4QixFQUFFLFVBQVUsT0FBTyxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQzNFLFNBQVMsS0FBSztBQUNaLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFQSxTQUFTLHFCQUFxQjtBQUM1QixRQUFNLGNBQWMsZUFBZTtBQUNuQyxRQUFNLE1BQU0sZ0JBQWdCO0FBQzVCLFFBQU0sU0FBUSxvQkFBSSxLQUFLLEdBQUUsWUFBWSxFQUFFLFFBQVEsU0FBUyxFQUFFLEVBQUUsUUFBUSxTQUFTLEVBQUU7QUFDL0UsU0FBTyxHQUFHLFdBQVcsSUFBSSxLQUFLLElBQUksR0FBRztBQUN2QztBQUVBLElBQU0sa0JBQWtCLFFBQVEsSUFBSSxvQkFBb0IsbUJBQW1CO0FBRTNFLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixRQUFRO0FBQUEsSUFDTixvQ0FBb0MsS0FBSyxVQUFVLGVBQWU7QUFBQSxFQUNwRTtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sSUFBSTtBQUFBLE1BQ0YsT0FBTyxDQUFDLE9BQU87QUFBQSxJQUNqQjtBQUFBLElBQ0EsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
