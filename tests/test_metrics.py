from analytics.metrics import filter_outliers


def test_filter_outliers_returns_original_values_when_standard_deviation_is_zero():
    values = [5, 5, 5]

    assert filter_outliers(values) == values
