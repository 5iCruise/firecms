import React, { useCallback, useMemo } from "react";

import { useCollectionFetch, useDataSource, useNavigationContext } from "../../../hooks";
import { useDataOrder } from "../../../hooks/data/useDataOrder";
import { Entity, EntityCollection, FilterValues, User } from "../../../types";
import { useDebouncedData } from "./useDebouncedData";

const DEFAULT_PAGE_SIZE = 50;

export type TableController<M extends Record<string, any> = any> = {
    data: Entity<M>[];
    dataLoading: boolean;
    noMoreToLoad: boolean;
    dataLoadingError?: Error;
    filterValues?: FilterValues<Extract<keyof M, string>>;
    setFilterValues: (filterValues: FilterValues<Extract<keyof M, string>>) => void;
    sortBy?: [Extract<keyof M, string>, "asc" | "desc"];
    setSortBy: (sortBy: [Extract<keyof M, string>, "asc" | "desc"]) => void;
    searchString?: string;
    setSearchString: (searchString?: string) => void;
    clearFilter: () => void;
    itemCount?: number;
    setItemCount: (itemCount: number) => void;
    pageSize: number;
    paginationEnabled: boolean;
    checkFilterCombination: (filterValues: FilterValues<any>,
                             sortBy?: [string, "asc" | "desc"]) => boolean;

}
export type TableControllerProps<M extends Record<string, any> = any> = {
    fullPath: string;
    collection: EntityCollection<M>;
    /**
     * List of entities that will be displayed on top, no matter the ordering.
     * This is used for reference fields selection
     */
    entitiesDisplayedFirst?: Entity<M>[];
    lastDeleteTimestamp?: number;
    forceFilter?: FilterValues<string>;
}

export function useTableController<M extends Record<string, any> = any, UserType extends User = User>(
    {
        fullPath,
        collection,
        entitiesDisplayedFirst,
        lastDeleteTimestamp,
        forceFilter: forceFilterFromProps
    }: TableControllerProps<M>)
    : TableController<M> {

    const {
        initialFilter,
        initialSort,
        forceFilter: forceFilterFromCollection
    } = collection;

    const navigation = useNavigationContext();
    const dataSource = useDataSource();
    const resolvedPath = useMemo(() => navigation.resolveAliasesFrom(fullPath), [fullPath, navigation.resolveAliasesFrom]);

    const forceFilter = forceFilterFromProps ?? forceFilterFromCollection;
    const paginationEnabled = collection.pagination === undefined || Boolean(collection.pagination);
    const pageSize = typeof collection.pagination === "number" ? collection.pagination : DEFAULT_PAGE_SIZE;

    const [searchString, setSearchString] = React.useState<string | undefined>();
    const [itemCount, setItemCount] = React.useState<number | undefined>(paginationEnabled ? pageSize : undefined);

    const checkFilterCombination = useCallback((filterValues: FilterValues<any>,
                                                sortBy?: [string, "asc" | "desc"]) => {
        if (!dataSource.isFilterCombinationValid)
            return true;
        return dataSource.isFilterCombinationValid({
            path: resolvedPath,
            collection,
            filterValues,
            sortBy
        })
    }, []);

    const initialSortInternal = useMemo(() => {
        if (initialSort && forceFilter && !checkFilterCombination(forceFilter, initialSort)) {
            console.warn("Initial sort is not compatible with the force filter. Ignoring initial sort");
            return undefined;
        }
        return initialSort;
    }, [initialSort, forceFilter]);

    const [filterValues, setFilterValues] = React.useState<FilterValues<Extract<keyof M, string>> | undefined>(forceFilter ?? initialFilter ?? undefined);
    const [sortBy, setSortBy] = React.useState<[Extract<keyof M, string>, "asc" | "desc"] | undefined>(initialSortInternal);

    const clearFilter = useCallback(() => setFilterValues(forceFilter ?? undefined), [forceFilter]);

    const {
        data: rawData,
        dataLoading,
        noMoreToLoad,
        dataLoadingError
    } = useCollectionFetch<M, UserType>({
        path: fullPath,
        collection,
        filterValues,
        sortBy,
        searchString,
        itemCount
    });

    const orderedData = useDataOrder({
        data: rawData,
        entitiesDisplayedFirst
    });

    // hack to fix Firestore listeners firing with incomplete data
    const data = useDebouncedData(orderedData, {
        filterValues,
        sortBy,
        searchString,
        lastDeleteTimestamp
    });

    return {
        data,
        dataLoading,
        noMoreToLoad,
        dataLoadingError,
        filterValues,
        setFilterValues,
        sortBy,
        setSortBy,
        searchString,
        setSearchString,
        clearFilter,
        itemCount,
        setItemCount,
        paginationEnabled,
        pageSize,
        checkFilterCombination
    }
}
