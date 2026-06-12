"use client";

import { Mail, ExternalLink, Globe } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-line bg-white/95 mt-auto">
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Contacto */}
          <div>
            <h3 className="font-semibold text-zinc-900 mb-4">{t("footer.contact")}</h3>
            <div className="space-y-3">
              <a
                href="mailto:nachogarbil@gmail.com"
                className="flex items-center gap-3 text-zinc-600 hover:text-accent transition"
              >
                <Mail className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">nachogarbil@gmail.com</span>
              </a>
              <a
                href="https://www.linkedin.com/in/igb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-zinc-600 hover:text-accent transition"
              >
                <ExternalLink className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">linkedin.com/in/igb</span>
              </a>
              <a
                href="https://ignacho02.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-zinc-600 hover:text-accent transition"
              >
                <Globe className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">ignacho02.github.io</span>
              </a>
            </div>
          </div>

          {/* Acerca de */}
          <div>
            <h3 className="font-semibold text-zinc-900 mb-4">{t("footer.about")}</h3>
            <p className="text-sm text-zinc-600 leading-relaxed">
              {t("footer.aboutBody")}
            </p>
          </div>

          {/* Información */}
          <div>
            <h3 className="font-semibold text-zinc-900 mb-4">{t("footer.information")}</h3>
            <ul className="space-y-2 text-sm text-zinc-600">
              <li>
                <span className="text-zinc-400">
                  {t("footer.privacy")}
                </span>
              </li>
              <li>
                <span className="text-zinc-400">
                  {t("footer.terms")}
                </span>
              </li>
              <li>
                <span className="text-zinc-400">
                  {t("footer.docs")}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divisor */}
        <div className="border-t border-line"></div>

        {/* Copyright */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            © 2024-2026 TalentOS. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
