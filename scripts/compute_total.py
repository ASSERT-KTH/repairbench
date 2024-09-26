#! /usr/bin/env python3

# Computes Total column entries for all models and all benchmarks available in the results directory.
# Metrics: AST Match @1, Plausible @1

import numpy as np
import pathlib
import json

def pass_at_k(n: int, c: int, k: int):
    """
    :param n: total number of samples
    :param c: number of correct samples
    :param k: k in pass@$k$
    """
    if n - c < k:
        return 1.0
    else:
        return 1.0 - np.prod(1.0 - k / np.arange(n - c + 1, n + 1))

def main():
    # Get all models
    models = pathlib.Path(__file__).parent.resolve().glob("../results/*")
    for model in models:
        try:
            total_patches = 0
            total_ast_match_patches = 0
            total_plausible_patches = 0
    
            # Iterate over benchmarks
            benchmarks = ["defects4j", "gitbugjava"]
            for benchmark in benchmarks:
                benchmark = pathlib.Path(model, benchmark)
                # Check if a statistics*.json file exists
                if not any(benchmark.glob("statistics*.json")):
                    raise Exception(f"No statistics*.json file found for {benchmark}")
    
                # Read the found file
                statistics_file = list(benchmark.glob("statistics*.json"))[0]
                with open(statistics_file, "r") as f:
                    data = json.load(f)
    
                total_patches += data["num_patches"]
                total_ast_match_patches += data["num_ast_match_patches"]
                total_plausible_patches += data["num_plausible_patches"]
    
            # Write total values to a file
            totals = {
                "num_patches": total_patches,
                "num_ast_match_patches": total_ast_match_patches,
                "num_plausible_patches": total_plausible_patches,
                "ast_match@1": round(pass_at_k(total_patches, total_ast_match_patches, 1), 3),
                "plausible@1": round(pass_at_k(total_patches, total_plausible_patches, 1), 3),
            }

            with open(f"{model}/total.json", "w") as f:
                json.dump(totals, f)

        except Exception as e:
            # delete total file if it exists
            if pathlib.Path(f"{model}/total.json").exists():
                pathlib.Path(f"{model}/total.json").unlink()


if __name__ == "__main__":
    main()
