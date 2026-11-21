import { useNeuro } from '../context/NeuroContext';

export function AnalyticsView() {
  const { agents } = useNeuro();
  const totalTokens = agents.reduce((sum, model) => sum + model.tokens, 0);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-[#fffdfa] border border-[#e7e2d9]">
        <h1 className="text-3xl font-semibold tracking-tight text-[#282820] sm:text-4xl">Model analytics</h1>
        <p className="mt-1.5 text-sm text-[#665f54] sm:text-base">Reported token usage and the latest latency for each connected model.</p>
      </div>

      {agents.length === 0 ? (
        <p className="p-6 rounded-3xl bg-[#fffdfa] border border-[#e7e2d9] text-sm text-[#665f54]">
          Connect a model to start collecting analytics.
        </p>
      ) : (
        <div className="p-6 rounded-3xl bg-[#fffdfa] border border-[#e7e2d9] space-y-4">
          <p className="text-sm text-[#4b4941]">
            <strong className="text-[#282820]">{totalTokens.toLocaleString()}</strong> reported tokens across connected models
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[#665f54]">
                <tr>
                  <th scope="col" className="py-2 pr-4">Model</th>
                  <th scope="col" className="py-2 pr-4 text-right">Reported tokens</th>
                  <th scope="col" className="py-2 text-right">Latest latency</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(model => (
                  <tr key={model.id} className="border-t border-[#e7e2d9]">
                    <th scope="row" className="py-2 pr-4 font-medium text-[#282820]">{model.name}</th>
                    <td className="py-2 pr-4 text-right tabular-nums">{model.tokens.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums">{model.latencyMs ? `${model.latencyMs} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
