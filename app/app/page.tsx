export default function Home() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Risk Library</h1>
      <p className="text-gray-600 mb-6">
        Describe a new job and surface semantically similar past risks and issues — with the
        actions taken and how they turned out. Scaffold in place; pages land next.
      </p>
      <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
        <li><strong>Assess</strong> — paste a project profile, see related past risks/issues ranked by similarity.</li>
        <li><strong>Capture</strong> — log a risk as cause → event → effect, with response and outcome.</li>
        <li><strong>Seed</strong> — fast bulk entry for the cold-start brain-dump of recurring risks.</li>
      </ul>
    </div>
  );
}
