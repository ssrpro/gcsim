import { FormGroup, NumericInput } from "@blueprintjs/core";
import { Executor, ExecutorSupplier, WasmExecutor } from "@gcsim/executors";
import { UI, useLocalStorage } from "@gcsim/ui";
import { useRef } from "react";

const minWorkers = 1;
const maxWorkers = 30;

let exec: Executor | undefined;

const App = ({}) => {
  const [workers, setWorkers] = useLocalStorage<number>("wasm-num-workers", 3);

  const supplier = useRef<ExecutorSupplier>(() => {
    if (exec == null) {
      exec = new WasmExecutor();
      exec.setWorkerCount(workers);
    }
    return exec;
  });

  const updateWorkers = (num: number) => {
    num = Math.min(Math.max(num, minWorkers), maxWorkers);
    setWorkers(num);
    supplier.current().setWorkerCount(num);
  };

  return (
    <UI exec={supplier.current}>
      <FormGroup className="!m-0" label="Workers">
        <NumericInput
          value={workers}
          onValueChange={(v) => updateWorkers(v)}
          min={minWorkers}
          max={maxWorkers}
          fill={true}
        />
      </FormGroup>
    </UI>
  );
};

export default App;