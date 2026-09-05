import { generate } from '../generator/generate';
import { solve } from '../solver/bfs';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      result: data.type === 'generate' ? generate(data.request) : solve(data.board, data.state),
    });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
