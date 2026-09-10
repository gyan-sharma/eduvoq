#!/usr/bin/env bash
# shellcheck shell=bash
# Sourced by deploy/lib.sh and run/lib-prod-server.sh - no `set -e`, no standalone execution.
#
# Infer safe Next.js build parallelism for Ubuntu VPS hosts (next.config.js reads these env vars).
# More workers speed up compile/static generation but raise peak RSS — pair with infer_build_heap_mb.

_host_ncpus() {
  local n
  if command -v nproc >/dev/null 2>&1; then
    n="$(nproc 2>/dev/null || echo 1)"
  elif command -v sysctl >/dev/null 2>&1; then
    n="$(sysctl -n hw.ncpu 2>/dev/null || echo 1)"
  else
    n=1
  fi
  if [[ ! "${n}" =~ ^[0-9]+$ ]] || [[ "${n}" -lt 1 ]]; then
    n=1
  fi
  echo "${n}"
}

_host_ram_mb() {
  if [[ -r /proc/meminfo ]]; then
    awk '/^MemTotal:/{print int($2 / 1024)}' /proc/meminfo
    return 0
  fi
  echo 0
}

# Echo worker CPU count for experimental.cpus (default 1 on tiny VPS).
infer_build_cpus() {
  local ncpus ram_mb max_by_cpu max_by_ram cpus
  ncpus="$(_host_ncpus)"
  ram_mb="$(_host_ram_mb)"

  if [[ "${ram_mb}" -le 0 ]]; then
    # macOS / unknown: modest default for local `npm run build` when env unset.
    if [[ "${ncpus}" -gt 4 ]]; then
      echo 4
    elif [[ "${ncpus}" -gt 1 ]]; then
      echo $((ncpus - 1))
    else
      echo 1
    fi
    return 0
  fi

  # ~500MB RSS headroom per extra worker beyond the main Node heap.
  max_by_ram=$(( (ram_mb - 1400) / 500 ))
  if [[ "${max_by_ram}" -lt 1 ]]; then
    max_by_ram=1
  fi

  if [[ "${ncpus}" -le 2 ]]; then
    max_by_cpu="${ncpus}"
  else
    max_by_cpu=$((ncpus - 1))
  fi

  cpus="${max_by_cpu}"
  if [[ "${cpus}" -gt "${max_by_ram}" ]]; then
    cpus="${max_by_ram}"
  fi
  if [[ "${cpus}" -gt 4 ]]; then
    cpus=4
  fi
  echo "${cpus}"
}

# Echo staticGenerationMaxConcurrency (OOM spikes during "Generating static pages").
infer_build_static_concurrency() {
  local cpus ram_mb static
  cpus="${1:-$(infer_build_cpus)}"
  ram_mb="$(_host_ram_mb)"

  if [[ "${ram_mb}" -le 0 ]]; then
    if [[ "${cpus}" -gt 4 ]]; then
      echo 4
    else
      echo "${cpus}"
    fi
    return 0
  fi

  if [[ "${ram_mb}" -lt 3072 ]]; then
    echo 1
    return 0
  fi

  if [[ "${ram_mb}" -lt 5120 ]]; then
    static="${cpus}"
    if [[ "${static}" -gt 2 ]]; then
      static=2
    fi
    echo "${static}"
    return 0
  fi

  static="${cpus}"
  if [[ "${static}" -gt 4 ]]; then
    static=4
  fi
  echo "${static}"
}

# Echo 1 or 0 for parallelServerCompiles / parallelServerBuildTraces.
infer_build_parallel_server() {
  local ram_mb ncpus
  ram_mb="$(_host_ram_mb)"
  ncpus="$(_host_ncpus)"

  if [[ "${ram_mb}" -le 0 ]]; then
    echo 1
    return 0
  fi

  if [[ "${ram_mb}" -ge 7800 ]] && [[ "${ncpus}" -ge 4 ]]; then
    echo 1
  else
    echo 0
  fi
}

# Export NEXT_BUILD_* when unset (respect explicit server / .env.prod overrides).
apply_inferred_build_parallelism() {
  local cpus static parallel

  if [[ -z "${NEXT_BUILD_CPUS:-}" ]]; then
    cpus="$(infer_build_cpus)"
    export NEXT_BUILD_CPUS="${cpus}"
  else
    cpus="${NEXT_BUILD_CPUS}"
  fi

  if [[ -z "${NEXT_BUILD_STATIC_CONCURRENCY:-}" ]]; then
    export NEXT_BUILD_STATIC_CONCURRENCY="$(infer_build_static_concurrency "${cpus}")"
  fi

  if [[ -z "${NEXT_BUILD_PARALLEL_SERVER:-}" ]]; then
    parallel="$(infer_build_parallel_server)"
    if [[ "${parallel}" == 1 ]]; then
      export NEXT_BUILD_PARALLEL_SERVER=1
    else
      export NEXT_BUILD_PARALLEL_SERVER=0
    fi
  fi
}
