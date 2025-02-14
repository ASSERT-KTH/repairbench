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
            total_prompt_tokens = 0
            total_completion_tokens = 0
            total_tokens = 0
            total_cost = 0
            number_bugs_with_ast_match_candidates = 0
            number_bugs_with_plausible_candidates = 0
            bugs_with_ast_match_candidates = []
            bugs_with_plausible_candidates = []
    
            # Iterate over benchmarks
            benchmarks = ["defects4j", "gitbugjava"]
            for benchmark in benchmarks:
                benchmark = pathlib.Path(model, benchmark)
                # Check if statistics and usage files exist
                if not any(benchmark.glob("statistics*.json")):
                    raise Exception(f"No statistics*.json file found for {benchmark}")
                if not any(benchmark.glob("usage*.json")):
                    raise Exception(f"No usage*.json file found for {benchmark}")
    
                # Read statistics file
                statistics_file = list(benchmark.glob("statistics*.json"))[0]
                with open(statistics_file, "r") as f:
                    data = json.load(f)
    
                total_patches += data["num_patches"]
                total_ast_match_patches += data["num_ast_match_patches"]
                total_plausible_patches += data["num_plausible_patches"]
                number_bugs_with_ast_match_candidates += data["num_bugs_with_ast_match_candidates"]
                number_bugs_with_plausible_candidates += data["num_bugs_with_plausible_candidates"]
                bugs_with_ast_match_candidates += data["bugs_with_ast_match_candidates"]
                bugs_with_plausible_candidates += data["bugs_with_plausible_candidates"]

                # Read usage file
                usage_file = list(benchmark.glob("usage*.json"))[0]
                with open(usage_file, "r") as f:
                    usage_data = json.load(f)
                
                total_prompt_tokens += usage_data.get("prompt_tokens", 0)
                total_completion_tokens += usage_data.get("completion_tokens", 0)
                total_tokens += usage_data.get("total_tokens", 0)
                total_cost += usage_data.get("total_cost", 0)
    
            # Write total values to a file
            totals = {
                "num_patches": total_patches,
                "num_ast_match_patches": total_ast_match_patches,
                "num_plausible_patches": total_plausible_patches,
                "num_bugs_with_ast_match_candidates": number_bugs_with_ast_match_candidates,
                "num_bugs_with_plausible_candidates": number_bugs_with_plausible_candidates,
                "ast_match@1": round(pass_at_k(total_patches, total_ast_match_patches, 1), 3),
                "plausible@1": round(pass_at_k(total_patches, total_plausible_patches, 1), 3),
                "bugs_with_ast_match_candidates": bugs_with_ast_match_candidates,
                "bugs_with_plausible_candidates": bugs_with_plausible_candidates,
                "prompt_tokens": total_prompt_tokens,
                "completion_tokens": total_completion_tokens,
                "total_tokens": total_tokens,
                "cost": total_cost
            }

            with open(f"{model}/total.json", "w") as f:
                json.dump(totals, f, indent=4)

        except Exception as e:
            print(f"Error processing {model}: {e}")
            # delete total file if it exists
            if pathlib.Path(f"{model}/total.json").exists():
                pathlib.Path(f"{model}/total.json").unlink()


if __name__ == "__main__":
    main()
