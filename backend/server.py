def calculate_metrics(data):
    if not data:
        return {"mean": 0, "median": 0, "std": 0}

    n = len(data)
    mean = sum(data) / n
    sorted_data = sorted(data)
    median = sorted_data[n // 2] if n % 2 else (sorted_data[n // 2 - 1] + sorted_data[n // 2]) / 2
    variance = sum((x - mean) ** 2 for x in data) / n
    std = variance ** 0.5

    return {"mean": mean, "median": median, "std": std, "count": n}


def filter_outliers(data, threshold=2):
    metrics = calculate_metrics(data)
    if metrics["std"] == 0:
        return list(data)
    return [x for x in data if abs(x - metrics["mean"]) <= threshold * metrics["std"]]


class DataStore:
    def __init__(self):
        self.store = {}

    def put(self, key, value):
        self.store[key] = value

    def get(self, key):
        return self.store.get(key)

    def delete(self, key):
        if key in self.store:
            del self.store[key]
            return True
        return False

    def search(self, pattern):
        results = []
        for key in self.store:
            if pattern in key:
                results.append((key, self.store[key]))
        return results
