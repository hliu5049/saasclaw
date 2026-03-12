export default function DashboardPage() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center"
      style={{ background: "#080810" }}
    >
      <div className="text-center">
        <div className="mb-4 text-[56px]">🦞</div>
        <h1 className="text-[18px] font-extrabold text-white">
          Enterprise OpenClaw
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "#555" }}>
          从左侧选择一个 Agent 开始管理
        </p>
      </div>
    </div>
  );
}
