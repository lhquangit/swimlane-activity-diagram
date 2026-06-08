import App from '../App';
import { LANES } from '../lane-config';
import {
  buildFireIncidentGraph,
  fireIncidentFeatureIntent,
  fireIncidentProjectSpec,
} from '../test-fixtures/fire-incident';

export default function EditorTestHarness() {
  return (
    <App
      seed={{
        graph: buildFireIncidentGraph(),
        lanes: LANES,
        projectSpec: fireIncidentProjectSpec,
        featureIntent: fireIncidentFeatureIntent,
      }}
    />
  );
}
