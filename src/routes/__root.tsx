import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PhoneFrame } from "@/components/phone-frame";
import { UserDataBridge } from "@/components/user-data-bridge";
import { PwaRegistration } from "@/components/pwa-registration";
import appCss from "../styles.css?url";

const APP_NAME = "Dose";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: APP_NAME },
      { name: "theme-color", content: "#09090b" },
      {
        name: "description",
        content: "A dose diária de evidência para médicos — edições, ofensiva e leitura guiada.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap",
      },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="antialiased">
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <PwaRegistration />
        <AuthProvider>
          <UserDataBridge />
          <PhoneFrame>
            <Outlet />
          </PhoneFrame>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
