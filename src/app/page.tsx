"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

type ServiceStatus = "loading" | "online" | "offline";

export default function Home() {
  const [status, setStatus] = useState<ServiceStatus>("loading");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setStatus("online");
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    }
    setLastCheck(new Date());
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    loading: {
      color: "bg-yellow-500",
      pulse: "animate-pulse",
      text: "Verificando...",
      textColor: "text-yellow-600 dark:text-yellow-400",
    },
    online: {
      color: "bg-emerald-500",
      pulse: "animate-pulse",
      text: "Online",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
    offline: {
      color: "bg-red-500",
      pulse: "",
      text: "Offline",
      textColor: "text-red-600 dark:text-red-400",
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br  font-sans">
      <main className="flex flex-col items-center gap-12 p-8">
        {/* Logo / Header */}
        <div className="flex flex-col items-center gap-2">

          <Image src="/logo.png" alt="Checklist Fácil" width={300} height={200} />
        </div>

        {/* Status Card */}
        <div className="flex flex-col items-center gap-8 rounded-3xl border border-zinc-400 p-10 shadow-xl shadow-zinc-200/50 bg-zinc-900 dark:shadow-black/30">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            API de conexão com o Checklist Fácil
          </h1>

          {/* Status Indicator */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              {/* Pulse ring */}
              <div
                className={`absolute h-24 w-24 rounded-full ${currentStatus.color} ${currentStatus.pulse} opacity-20`}
              />
              <div
                className={`absolute h-20 w-20 rounded-full ${currentStatus.color} ${currentStatus.pulse} opacity-30`}
                style={{ animationDelay: "150ms" }}
              />
              {/* Main circle */}
              <div
                className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full ${currentStatus.color} shadow-lg`}
              >
                {status === "online" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-8 w-8 text-white"
                  >
                    <path
                      fillRule="evenodd"
                      d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {status === "offline" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-8 w-8 text-white"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {status === "loading" && (
                  <svg
                    className="h-8 w-8 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className={`text-xl font-semibold ${currentStatus.textColor}`}>
                {currentStatus.text}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {status === "online"
                  ? "Todos os sistemas operacionais"
                  : status === "offline"
                  ? "Serviço temporariamente indisponível"
                  : "Aguarde..."}
              </span>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex w-full flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Última verificação</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {lastCheck ? lastCheck.toLocaleTimeString("pt-BR") : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Intervalo</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">30 segundos</span>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={checkHealth}
            disabled={status === "loading"}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                clipRule="evenodd"
              />
            </svg>
            Verificar agora
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Sistema de integração com Checklist Fácil
        </p>
      </main>
    </div>
  );
}