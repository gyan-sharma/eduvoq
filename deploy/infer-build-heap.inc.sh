#!/usr/bin/env bash
# shellcheck shell=bash
# Sourced by deploy/lib.sh and run/lib-prod-server.sh - no `set -e`, no standalone execution.

# Echo a safe Node --max-old-space-size (MB) for `next build` when BUILD_NODE_HEAP_MB is unset.
# A fixed 4096MB heap on a 2GB VPS often ends with the kernel OOM killer ("Killed") because RSS
# + mmap + system buffers exceed RAM. Uses MemTotal + SwapTotal from /proc/meminfo when present.
#
# Swap is not treated 1:1 with RAM: a large inferred heap still spikes RSS during compile/SGC,
# and the OOM killer uses total pressure, not V8's --max-old-space-size alone.
infer_build_heap_mb() {
  local total_kb swap_kb total_mb swap_mb physical_budget swap_credit eff heap
  if [[ ! -r /proc/meminfo ]]; then
    # macOS / non-Linux: no MemTotal; stay conservative (Darwin build is usually local dev).
    echo 2048
    return 0
  fi
  total_kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
  swap_kb=$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)
  total_mb=$((total_kb / 1024))
  swap_mb=$((swap_kb / 1024))
  # Budget from RAM after OS + MySQL + headroom (typical single-node school VPS).
  physical_budget=$((total_mb - 1100))
  if [[ "${physical_budget}" -lt 256 ]]; then
    physical_budget=256
  fi
  # Only part of swap counts toward "safe" extra heap budget (swap helps thrash, not infinite RSS).
  swap_credit=$((swap_mb / 3))
  eff=$((physical_budget + swap_credit))
  heap="${eff}"
  if [[ "${heap}" -lt 768 ]]; then
    heap=768
  fi
  # Cap below 4G: total Node RSS often exceeds this cap during Turbopack + static workers.
  if [[ "${heap}" -gt 3072 ]]; then
    heap=3072
  fi
  echo "${heap}"
}
