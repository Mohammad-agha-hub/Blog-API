class Pagination{
    static paginate(page=1,limit=10){
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        // Validate
        const validPage = pageNum>0?pageNum:1;
        const validLimit = limitNum>0 && limitNum<=100?limitNum:10;
        const offset = (validPage-1)*validLimit;
        return {
            limit:validLimit,
            offset,
            page:validPage
        }

    }
    static buildResponse(data,totalCount,page,limit){
        const totalPages = Math.ceil(totalCount/limit);
        return{
            data,
            pagination:{
                currentPage:parseInt(page),
                totalPages,
                totalItems:totalCount,
                itemsPerPage:parseInt(limit),
                hasNextPage:page<totalPages,
                hasPrevPage:page>1
            }
        }
    }
}

export default Pagination;